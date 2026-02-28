import { internal } from "@repo/backend/convex/_generated/api";
import { logger } from "@repo/backend/convex/utils/logger";
import { workflow } from "@repo/backend/convex/workflow";
import { v } from "convex/values";

/**
 * Orchestrator workflow that manages the entire credit reset process.
 * 1. Creates job record
 * 2. Populates queue with all users
 * 3. Spawns parallel worker workflows
 */
export const orchestrateReset = workflow.define({
  args: {
    plan: v.union(v.literal("free"), v.literal("pro")),
    resetTimestamp: v.number(),
  },
  returns: v.null(),
  handler: async (step, args) => {
    const jobType = args.plan === "free" ? "free-daily" : "pro-monthly";
    const creditAmount = args.plan === "pro" ? 3000 : 10;
    const grantType = args.plan === "pro" ? "monthly-grant" : "daily-grant";

    logger.info(`Starting ${jobType} credit reset orchestration`, {
      plan: args.plan,
      resetTimestamp: args.resetTimestamp,
    });

    // Step 1: Create job record
    const jobId = await step.runMutation(
      internal.credits.mutations.createResetJob,
      {
        jobType,
        resetTimestamp: args.resetTimestamp,
      }
    );

    logger.info(`${jobType} job created`, { jobId });

    // Step 2: Populate queue with users
    const totalUsers = await step.runMutation(
      internal.credits.mutations.populateQueue,
      {
        plan: args.plan,
        resetTimestamp: args.resetTimestamp,
      }
    );

    logger.info(`${jobType} queue populated`, {
      jobId,
      totalUsers,
    });

    // Step 3: Spawn parallel workers
    const WORKER_COUNT = 10;
    await Promise.all(
      Array.from({ length: WORKER_COUNT }, (_, i) =>
        step.runWorkflow(internal.credits.workflows.processQueue, {
          jobId,
          plan: args.plan,
          resetTimestamp: args.resetTimestamp,
          workerId: i,
          creditAmount,
          grantType,
        })
      )
    );

    logger.info(`${jobType} workers completed`, {
      jobId,
      workerCount: WORKER_COUNT,
    });

    // Step 4: Complete job
    await step.runMutation(internal.credits.mutations.completeResetJob, {
      jobId,
    });

    logger.info(`${jobType} reset completed`, { jobId });

    return null;
  },
});

/**
 * Worker workflow that processes credit reset queue items.
 * Multiple instances run in parallel.
 */
export const processQueue = workflow.define({
  args: {
    jobId: v.id("creditResetJobs"),
    plan: v.union(v.literal("free"), v.literal("pro")),
    resetTimestamp: v.number(),
    workerId: v.number(),
    creditAmount: v.number(),
    grantType: v.union(v.literal("daily-grant"), v.literal("monthly-grant")),
  },
  returns: v.null(),
  handler: async (step, args) => {
    const BATCH_SIZE = 100;
    let totalProcessed = 0;

    logger.info(`Worker ${args.workerId} started`, {
      jobId: args.jobId,
      plan: args.plan,
    });

    while (true) {
      // Claim items from queue
      const items = await step.runMutation(
        internal.credits.mutations.claimQueueItems,
        {
          plan: args.plan,
          resetTimestamp: args.resetTimestamp,
          batchSize: BATCH_SIZE,
        }
      );

      if (items.length === 0) {
        logger.info(`Worker ${args.workerId} finished`, {
          jobId: args.jobId,
          totalProcessed,
        });
        break;
      }

      // Process items in parallel
      await Promise.all(
        items.map((item) => {
          return step.runMutation(internal.credits.mutations.resetUserCredits, {
            userId: item.userId,
            creditAmount: args.creditAmount,
            grantType: args.grantType,
            resetTimestamp: args.resetTimestamp,
            previousBalance: item.credits ?? 0,
          });
        })
      );

      // Mark items as completed
      await step.runMutation(internal.credits.mutations.completeQueueItems, {
        queueIds: items.map((item) => item.queueId),
      });

      totalProcessed += items.length;

      logger.info(`Worker ${args.workerId} processed batch`, {
        jobId: args.jobId,
        batchSize: items.length,
        totalProcessed,
      });

      if (items.length < BATCH_SIZE) {
        break;
      }
    }

    return null;
  },
});
