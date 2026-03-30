import { internal } from "@repo/backend/convex/_generated/api";
import {
  getPlanCreditConfig,
  RESET_WORKFLOW_CONFIG,
} from "@repo/backend/convex/credits/constants";
import { logger } from "@repo/backend/convex/utils/logger";
import { workflow } from "@repo/backend/convex/workflow";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

/**
 * Orchestrates a partitioned credit reset workflow.
 */
export const orchestrateReset = workflow.define({
  args: {
    plan: literals("free", "pro"),
    resetTimestamp: v.number(),
  },
  returns: v.null(),
  handler: async (step, args) => {
    const creditConfig = getPlanCreditConfig(args.plan);

    logger.info(`Starting ${creditConfig.jobType} credit reset orchestration`, {
      plan: args.plan,
      resetTimestamp: args.resetTimestamp,
      partitionCount: RESET_WORKFLOW_CONFIG.partitionCount,
    });

    const jobId = await step.runMutation(
      internal.credits.mutations.createResetJob,
      {
        jobType: creditConfig.jobType,
        resetTimestamp: args.resetTimestamp,
      }
    );

    logger.info(`${creditConfig.jobType} job created`, { jobId });

    // Populate queue using Convex built-in pagination
    // Following Convex best practice: Use .paginate() for large datasets
    // Reference: https://docs.convex.dev/database/pagination
    let totalUsers = 0;

    let result = await step.runMutation(
      internal.credits.mutations.populateQueueBatch,
      {
        jobId,
        plan: args.plan,
        resetTimestamp: args.resetTimestamp,
        paginationOpts: {
          numItems: RESET_WORKFLOW_CONFIG.populateBatchSize,
          cursor: null,
        },
      }
    );

    while (true) {
      totalUsers += result.usersAdded;

      if (result.isDone) {
        break;
      }

      result = await step.runMutation(
        internal.credits.mutations.populateQueueBatch,
        {
          jobId,
          plan: args.plan,
          resetTimestamp: args.resetTimestamp,
          paginationOpts: {
            numItems: RESET_WORKFLOW_CONFIG.populateBatchSize,
            cursor: result.continueCursor,
          },
        }
      );
    }

    // Update job with total users count
    await step.runMutation(internal.credits.mutations.updateJobTotalUsers, {
      jobId,
      totalUsers,
    });

    logger.info(`${creditConfig.jobType} queue populated`, {
      jobId,
      totalUsers,
    });

    if (totalUsers === 0) {
      logger.info(
        `${creditConfig.jobType} no users to process, completing job`,
        { jobId }
      );
      await step.runMutation(internal.credits.mutations.completeResetJob, {
        jobId,
      });
      return null;
    }

    const workers = Array.from(
      { length: RESET_WORKFLOW_CONFIG.partitionCount },
      (_, partition) =>
        step.runWorkflow(internal.credits.workflows.processQueue, {
          jobId,
          plan: args.plan,
          resetTimestamp: args.resetTimestamp,
          partition,
          creditAmount: creditConfig.amount,
          grantType: creditConfig.grantType,
        })
    );

    logger.info(`${creditConfig.jobType} spawned partition workers`, {
      jobId,
      partitionCount: RESET_WORKFLOW_CONFIG.partitionCount,
    });

    // Wait for all workers to complete
    await Promise.all(workers);

    logger.info(`${creditConfig.jobType} all workers completed`, {
      jobId,
      partitionCount: RESET_WORKFLOW_CONFIG.partitionCount,
    });

    await step.runMutation(internal.credits.mutations.completeResetJob, {
      jobId,
    });

    logger.info(`${creditConfig.jobType} reset completed`, { jobId });

    return null;
  },
});

/**
 * Worker workflow that processes batches of credit resets.
 */
export const processQueue = workflow.define({
  args: {
    jobId: v.id("creditResetJobs"),
    plan: literals("free", "pro"),
    resetTimestamp: v.number(),
    partition: v.number(),
    creditAmount: v.number(),
    grantType: literals("daily-grant", "monthly-grant"),
  },
  returns: v.null(),
  handler: async (step, args) => {
    logger.info("Credit reset partition worker started", {
      jobId: args.jobId,
      partition: args.partition,
      plan: args.plan,
    });

    while (true) {
      const items = await step.runMutation(
        internal.credits.mutations.claimQueueItems,
        {
          plan: args.plan,
          resetTimestamp: args.resetTimestamp,
          partition: args.partition,
          batchSize: RESET_WORKFLOW_CONFIG.processBatchSize,
        }
      );

      if (items.length === 0) {
        logger.info("Credit reset partition worker finished", {
          jobId: args.jobId,
          partition: args.partition,
        });
        break;
      }

      const result = await step.runMutation(
        internal.credits.mutations.batchResetUserCredits,
        {
          items,
          creditAmount: args.creditAmount,
          grantType: args.grantType,
          resetTimestamp: args.resetTimestamp,
        }
      );

      if (result.failureCount > 0) {
        logger.error("Credit reset partition batch had failures", {
          jobId: args.jobId,
          partition: args.partition,
          successCount: result.successCount,
          failureCount: result.failureCount,
        });
      }
    }

    return null;
  },
});
