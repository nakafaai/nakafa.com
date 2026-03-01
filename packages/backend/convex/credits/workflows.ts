import { internal } from "@repo/backend/convex/_generated/api";
import { logger } from "@repo/backend/convex/utils/logger";
import { workflow } from "@repo/backend/convex/workflow";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

/**
 * Dynamic scaling configuration
 * These can be adjusted via environment variables in production
 */
const MIN_WORKERS = 1;
const MAX_WORKERS = 50;
const SCALE_UP_THRESHOLD = 0.5;
const CHECK_INTERVAL_MS = 30_000;
const PROGRESS_REPORT_INTERVAL = 10;

/**
 * Orchestrator workflow with dynamic scaling.
 *
 * Scales workers from MIN_WORKERS (1) to MAX_WORKERS (50) based on queue size.
 * Workers self-terminate when queue is empty.
 *
 * Flow:
 * 1. Create job record
 * 2. Populate queue with users
 * 3. Start with MIN_WORKERS
 * 4. Monitor progress and scale up if queue not draining fast enough
 * 5. Complete job when all workers finish
 */
export const orchestrateReset = workflow.define({
  args: {
    plan: literals("free", "pro"),
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
      minWorkers: MIN_WORKERS,
      maxWorkers: MAX_WORKERS,
    });

    const jobId = await step.runMutation(
      internal.credits.mutations.createResetJob,
      {
        jobType,
        resetTimestamp: args.resetTimestamp,
      }
    );

    logger.info(`${jobType} job created`, { jobId });

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

    if (totalUsers === 0) {
      logger.info(`${jobType} no users to process, completing job`, { jobId });
      await step.runMutation(internal.credits.mutations.completeResetJob, {
        jobId,
      });
      return null;
    }

    const workers: Promise<null>[] = [];

    for (let i = 0; i < MIN_WORKERS; i++) {
      workers.push(
        step.runWorkflow(internal.credits.workflows.processQueue, {
          jobId,
          plan: args.plan,
          resetTimestamp: args.resetTimestamp,
          workerId: i,
          creditAmount,
          grantType,
        })
      );
    }

    let currentWorkers = MIN_WORKERS;
    let lastScaleUpTime = Date.now();

    while (workers.length > 0) {
      await Promise.race([
        Promise.all(workers),
        new Promise((resolve) => setTimeout(resolve, CHECK_INTERVAL_MS)),
      ]);

      const hasPending = await step.runQuery(
        internal.credits.queries.hasPendingQueueItems,
        {
          plan: args.plan,
          resetTimestamp: args.resetTimestamp,
        }
      );

      if (!hasPending) {
        logger.info(`${jobType} queue drained, waiting for workers to finish`, {
          jobId,
        });
        await Promise.all(workers);
        break;
      }

      const timeSinceLastScale = Date.now() - lastScaleUpTime;

      if (
        currentWorkers < MAX_WORKERS &&
        timeSinceLastScale > CHECK_INTERVAL_MS
      ) {
        const workersToAdd = Math.min(
          Math.ceil(currentWorkers * SCALE_UP_THRESHOLD),
          MAX_WORKERS - currentWorkers
        );

        logger.info(`${jobType} scaling up workers`, {
          jobId,
          currentWorkers,
          workersToAdd,
          totalWillBe: currentWorkers + workersToAdd,
        });

        for (let i = 0; i < workersToAdd; i++) {
          const workerId = currentWorkers + i;
          workers.push(
            step.runWorkflow(internal.credits.workflows.processQueue, {
              jobId,
              plan: args.plan,
              resetTimestamp: args.resetTimestamp,
              workerId,
              creditAmount,
              grantType,
            })
          );
        }

        currentWorkers += workersToAdd;
        lastScaleUpTime = Date.now();
      }

      const progress = await step.runQuery(
        internal.credits.queries.getJobProgress,
        { jobId }
      );

      logger.info(`${jobType} progress update`, {
        jobId,
        processed: progress.processedUsers,
        total: progress.totalUsers,
        currentWorkers,
      });
    }

    logger.info(`${jobType} all workers completed`, {
      jobId,
      totalWorkersSpawned: currentWorkers,
    });

    await step.runMutation(internal.credits.mutations.completeResetJob, {
      jobId,
    });

    logger.info(`${jobType} reset completed`, { jobId });

    return null;
  },
});

/**
 * Worker workflow that processes credit reset queue items.
 * Runs until queue is empty, reporting progress periodically.
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
    const BATCH_SIZE = 100;
    let totalProcessed = 0;
    let batchCount = 0;

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

      await step.runMutation(internal.credits.mutations.completeQueueItems, {
        queueIds: items.map((item) => item.queueId),
      });

      totalProcessed += items.length;
      batchCount++;

      if (batchCount % PROGRESS_REPORT_INTERVAL === 0) {
        await step.runMutation(
          internal.credits.mutations.incrementJobProgress,
          {
            jobId: args.jobId,
            increment: totalProcessed,
          }
        );

        logger.info(`Worker ${args.workerId} progress report`, {
          jobId: args.jobId,
          batchCount,
          totalProcessed,
        });

        totalProcessed = 0;
      }

      if (items.length < BATCH_SIZE) {
        await step.runMutation(
          internal.credits.mutations.incrementJobProgress,
          {
            jobId: args.jobId,
            increment: totalProcessed,
          }
        );
        break;
      }
    }

    return null;
  },
});
