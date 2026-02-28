import { internal } from "@repo/backend/convex/_generated/api";
import { logger } from "@repo/backend/convex/utils/logger";
import { workflow } from "@repo/backend/convex/workflow";
import { v } from "convex/values";

/**
 * Resets credits for a batch of users. Idempotent steps, survives crashes.
 * Processes users in parallel using workpool for scalability.
 */
export const resetCreditsBatch = workflow.define({
  args: {
    jobId: v.id("creditResetJobs"),
    resetTimestamp: v.number(),
    isPro: v.boolean(),
    cursor: v.optional(v.id("users")),
    processedCount: v.number(),
  },
  returns: v.null(),
  handler: async (step, args) => {
    const creditAmount = args.isPro ? 3000 : 10;
    const grantType = args.isPro ? "monthly-grant" : "daily-grant";
    const batchSize = 1000;

    logger.info("Credit reset batch started", {
      jobId: args.jobId,
      isPro: args.isPro,
      processedCount: args.processedCount,
    });

    // Step 1: Get batch of users needing reset
    const users = await step.runQuery(
      internal.credits.queries.getUsersNeedingReset,
      {
        resetTimestamp: args.resetTimestamp,
        cursor: args.cursor,
        batchSize,
      }
    );

    if (users.length === 0) {
      logger.info("Credit reset completed - no more users", {
        jobId: args.jobId,
        totalProcessed: args.processedCount,
      });

      // Mark job as completed
      await step.runMutation(internal.credits.mutations.completeResetJob, {
        jobId: args.jobId,
        totalProcessed: args.processedCount,
      });

      return null;
    }

    logger.info("Processing credit reset batch", {
      jobId: args.jobId,
      batchSize: users.length,
      processedSoFar: args.processedCount,
    });

    // Step 2: Process each user with idempotent mutation
    // Using runMutation with retry config for resilience
    await Promise.all(
      users.map((user) =>
        step.runMutation(
          internal.credits.mutations.resetUserCredits,
          {
            userId: user._id,
            creditAmount,
            grantType,
            resetTimestamp: args.resetTimestamp,
            previousBalance: user.credits ?? 0,
          },
          {
            name: `reset-credits-${user._id}`,
          }
        )
      )
    );

    // Step 3: Continue with next batch
    const lastUser = users.at(-1);
    const newProcessedCount = args.processedCount + users.length;

    logger.info("Credit reset batch complete, continuing", {
      jobId: args.jobId,
      batchProcessed: users.length,
      newTotal: newProcessedCount,
    });

    await step.runWorkflow(internal.credits.workflows.resetCreditsBatch, {
      jobId: args.jobId,
      resetTimestamp: args.resetTimestamp,
      isPro: args.isPro,
      cursor: lastUser?._id,
      processedCount: newProcessedCount,
    });

    return null;
  },
});
