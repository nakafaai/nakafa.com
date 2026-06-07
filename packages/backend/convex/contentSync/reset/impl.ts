import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  batchDeleteResultValidator,
  eventTryoutEntitlementBatchSize,
  type ResettableTableName,
  resetBatchSize,
} from "@repo/backend/convex/contentSync/reset/spec";
import { internalMutation } from "@repo/backend/convex/functions";
import { ConvexError } from "convex/values";

/** Deletes one bounded batch from a resettable content-derived table. */
export async function deleteBatchFromTable(
  ctx: MutationCtx,
  tableName: ResettableTableName
) {
  const docs = await ctx.db.query(tableName).take(resetBatchSize);
  let deleted = 0;

  for (const doc of docs) {
    await ctx.db.delete(tableName, doc._id);
    deleted++;
  }

  const hasMore = (await ctx.db.query(tableName).first()) !== null;

  return { deleted, hasMore };
}

/**
 * Deletes tryout part attempts together with their owned exercise attempts and
 * exercise answers.
 */
export async function deleteTryoutRuntimeRows(ctx: MutationCtx) {
  const partAttempts = await ctx.db
    .query("tryoutPartAttempts")
    .take(resetBatchSize);
  let deleted = 0;

  for (const partAttempt of partAttempts) {
    const exerciseAttempt = await ctx.db.get(
      "exerciseAttempts",
      partAttempt.setAttemptId
    );

    if (exerciseAttempt) {
      const answers = await ctx.db
        .query("exerciseAnswers")
        .withIndex("by_attemptId_and_exerciseNumber", (q) =>
          q.eq("attemptId", exerciseAttempt._id)
        )
        .take(exerciseAttempt.totalExercises + 1);

      if (answers.length > exerciseAttempt.totalExercises) {
        throw new ConvexError({
          code: "TRYOUT_EXERCISE_ANSWER_COUNT_EXCEEDED",
          message:
            "Tryout exercise answer count exceeds the exercise attempt total exercises.",
        });
      }

      for (const answer of answers) {
        await ctx.db.delete("exerciseAnswers", answer._id);
      }

      await ctx.db.delete("exerciseAttempts", exerciseAttempt._id);
    }

    await ctx.db.delete("tryoutPartAttempts", partAttempt._id);
    deleted += 1;
  }

  const hasMore = (await ctx.db.query("tryoutPartAttempts").first()) !== null;

  return { deleted, hasMore };
}

/**
 * Deletes generated audio rows with their Convex storage blobs.
 *
 * @see https://docs.convex.dev/file-storage/delete-files
 */
export async function deleteContentAudioRows(ctx: MutationCtx) {
  const audios = await ctx.db.query("contentAudios").take(resetBatchSize);
  let deleted = 0;

  for (const audio of audios) {
    if (audio.audioStorageId) {
      const metadata = await ctx.db.system.get(
        "_storage",
        audio.audioStorageId
      );

      if (metadata) {
        await ctx.storage.delete(audio.audioStorageId);
      }
    }

    await ctx.db.delete("contentAudios", audio._id);
    deleted += 1;
  }

  const hasMore = (await ctx.db.query("contentAudios").first()) !== null;

  return { deleted, hasMore };
}

/** Deletes one bounded batch of stored tryout entitlements. */
export async function deleteTryoutEntitlementRows(ctx: MutationCtx) {
  const entitlements = await ctx.db
    .query("userTryoutEntitlements")
    .take(eventTryoutEntitlementBatchSize);

  for (const entitlement of entitlements) {
    await ctx.db.delete("userTryoutEntitlements", entitlement._id);
  }

  const hasMore =
    (await ctx.db.query("userTryoutEntitlements").first()) !== null;

  return {
    deleted: entitlements.length,
    hasMore,
  };
}

/** Creates one small internal mutation that deletes a single bounded batch. */
export function createBatchDeleteMutation(tableName: ResettableTableName) {
  return internalMutation({
    args: {},
    returns: batchDeleteResultValidator,
    handler: async (ctx) => deleteBatchFromTable(ctx, tableName),
  });
}
