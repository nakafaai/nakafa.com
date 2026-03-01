import { internal } from "@repo/backend/convex/_generated/api";
import { logger } from "@repo/backend/convex/utils/logger";
import { workflow } from "@repo/backend/convex/workflow";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

const MIN_WORKERS = 1;
const MAX_WORKERS = 50;
const SCALE_UP_THRESHOLD = 0.5;
const CHECK_INTERVAL_MS = 30_000;
const PROGRESS_REPORT_INTERVAL = 10;

/**
 * Orchestrates the credit reset workflow with dynamic worker scaling.
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

    // Populate queue and update job total in single mutation
    // Following Convex best practice: minimize workflow steps
    // Reference: https://docs.convex.dev/components/workflow
    await step.runMutation(internal.credits.mutations.populateQueue, {
      jobId,
      plan: args.plan,
      resetTimestamp: args.resetTimestamp,
    });

    // Query job to check totalUsers and log progress
    const job = await step.runQuery(internal.credits.queries.getJobProgress, {
      jobId,
    });

    logger.info(`${jobType} queue populated`, {
      jobId,
      totalUsers: job.totalUsers,
    });

    if (job.totalUsers === 0) {
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
    const BATCH_SIZE = 100;
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
          batchSize: BATCH_SIZE,
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

      cumulativeProcessed += result.successCount;
      batchCount++;

      // Report progress every PROGRESS_REPORT_INTERVAL batches
      if (batchCount % PROGRESS_REPORT_INTERVAL === 0) {
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
      if (items.length < BATCH_SIZE) {
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
