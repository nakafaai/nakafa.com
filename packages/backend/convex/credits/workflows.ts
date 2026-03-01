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
 * Orchestrates the credit reset workflow with fixed worker pool.
 * Note: Convex workflows don't support setTimeout or Date.now(),
 * so we use a fixed number of workers instead of dynamic scaling.
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
      maxWorkers: RESET_WORKFLOW_CONFIG.maxWorkers,
    });

    const jobId = await step.runMutation(
      internal.credits.mutations.createResetJob,
      {
        jobType: creditConfig.jobType,
        resetTimestamp: args.resetTimestamp,
      }
    );

    logger.info(`${creditConfig.jobType} job created`, { jobId });

    // Populate queue in batched workflow steps
    // Following Convex best practice: Keep each mutation within limits
    // Reference: https://docs.convex.dev/production/state/limits
    let totalUsers = 0;

    while (true) {
      const result = await step.runMutation(
        internal.credits.mutations.populateQueueBatch,
        {
          jobId,
          plan: args.plan,
          resetTimestamp: args.resetTimestamp,
          batchSize: RESET_WORKFLOW_CONFIG.populateBatchSize,
        }
      );

      totalUsers += result.usersAdded;

      if (!result.hasMore) {
        break;
      }
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

    // Spawn fixed number of workers (no dynamic scaling - Convex workflow limitation)
    // Workflows don't support setTimeout or Date.now()
    const workers: Promise<null>[] = [];

    for (let i = 0; i < RESET_WORKFLOW_CONFIG.maxWorkers; i++) {
      workers.push(
        step.runWorkflow(internal.credits.workflows.processQueue, {
          jobId,
          plan: args.plan,
          resetTimestamp: args.resetTimestamp,
          workerId: i,
          creditAmount: creditConfig.amount,
          grantType: creditConfig.grantType,
        })
      );
    }

    logger.info(
      `${creditConfig.jobType} spawned ${RESET_WORKFLOW_CONFIG.maxWorkers} workers`,
      {
        jobId,
        totalWorkers: RESET_WORKFLOW_CONFIG.maxWorkers,
      }
    );

    // Wait for all workers to complete
    await Promise.all(workers);

    logger.info(`${creditConfig.jobType} all workers completed`, {
      jobId,
      totalWorkersSpawned: RESET_WORKFLOW_CONFIG.maxWorkers,
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
    workerId: v.number(),
    creditAmount: v.number(),
    grantType: literals("daily-grant", "monthly-grant"),
  },
  returns: v.null(),
  handler: async (step, args) => {
    let batchCount = 0;
    let cumulativeProcessed = 0;
    let lastReportedCount = 0;

    logger.info(`Worker ${args.workerId} started`, {
      jobId: args.jobId,
      plan: args.plan,
    });

    while (true) {
      const items = await step.runMutation(
        internal.credits.mutations.claimQueueItems,
        {
          plan: args.plan,
          resetTimestamp: args.resetTimestamp,
          batchSize: RESET_WORKFLOW_CONFIG.processBatchSize,
        }
      );

      if (items.length === 0) {
        // Report any remaining unreported progress before exiting
        const unreportedCount = cumulativeProcessed - lastReportedCount;
        if (unreportedCount > 0) {
          await step.runMutation(
            internal.credits.mutations.incrementJobProgress,
            {
              jobId: args.jobId,
              increment: unreportedCount,
            }
          );
        }

        logger.info(`Worker ${args.workerId} finished`, {
          jobId: args.jobId,
          totalProcessed: cumulativeProcessed,
        });
        break;
      }

      const result = await step.runMutation(
        internal.credits.mutations.batchResetUserCredits,
        {
          items: items.map((item) => ({
            queueId: item.queueId,
            userId: item.userId,
            previousBalance: item.credits ?? 0,
          })),
          creditAmount: args.creditAmount,
          grantType: args.grantType,
          resetTimestamp: args.resetTimestamp,
        }
      );

      if (result.failureCount > 0) {
        logger.error(
          `Worker ${args.workerId} batch had ${result.failureCount} failures`,
          {
            jobId: args.jobId,
            successCount: result.successCount,
            failureCount: result.failureCount,
          }
        );
      }

      // Count ALL attempted items (successes + failures) for accurate progress tracking
      cumulativeProcessed += result.successCount + result.failureCount;
      batchCount++;

      // Report progress every RESET_WORKFLOW_CONFIG.progressReportInterval batches
      if (batchCount % RESET_WORKFLOW_CONFIG.progressReportInterval === 0) {
        const unreportedCount = cumulativeProcessed - lastReportedCount;
        if (unreportedCount > 0) {
          await step.runMutation(
            internal.credits.mutations.incrementJobProgress,
            {
              jobId: args.jobId,
              increment: unreportedCount,
            }
          );
          lastReportedCount = cumulativeProcessed;
        }

        logger.info(`Worker ${args.workerId} progress report`, {
          jobId: args.jobId,
          batchCount,
          reportedCount: unreportedCount,
          cumulativeProcessed,
        });
      }

      // Last batch - report any remaining unreported progress
      if (items.length < RESET_WORKFLOW_CONFIG.processBatchSize) {
        const unreportedCount = cumulativeProcessed - lastReportedCount;
        if (unreportedCount > 0) {
          await step.runMutation(
            internal.credits.mutations.incrementJobProgress,
            {
              jobId: args.jobId,
              increment: unreportedCount,
            }
          );
        }

        break;
      }
    }

    return null;
  },
});
