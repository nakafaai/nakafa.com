import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  batchDeleteResultValidator,
  contentSearchResetBatchSize,
  eventTryoutEntitlementBatchSize,
  type ResettableTableName,
  resetBatchSize,
} from "@repo/backend/convex/contentSync/reset/spec";
import { internalMutation } from "@repo/backend/convex/functions";

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
 * Deletes one small batch of full-text search rows.
 *
 * Search documents can contain large MDX text payloads, so the generic reset
 * batch can exceed Convex's per-function read byte limit before the reset loop
 * gets a chance to continue.
 */
export async function deleteContentSearchRows(ctx: MutationCtx) {
  const docs = await ctx.db
    .query("contentSearch")
    .take(contentSearchResetBatchSize);
  let deleted = 0;

  for (const doc of docs) {
    await ctx.db.delete(doc._id);
    deleted++;
  }

  const hasMore = (await ctx.db.query("contentSearch").first()) !== null;

  return { deleted, hasMore };
}

/** Deletes one bounded batch of section attempts owned by tryout attempts. */
export async function deleteTryoutRuntimeRows(ctx: MutationCtx) {
  const sectionAttempts = await ctx.db
    .query("tryoutSectionAttempts")
    .take(resetBatchSize);
  let deleted = 0;

  for (const sectionAttempt of sectionAttempts) {
    await ctx.db.delete("tryoutSectionAttempts", sectionAttempt._id);
    deleted += 1;
  }

  const hasMore =
    (await ctx.db.query("tryoutSectionAttempts").first()) !== null;

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
    .query("tryoutEntitlements")
    .take(eventTryoutEntitlementBatchSize);

  for (const entitlement of entitlements) {
    await ctx.db.delete("tryoutEntitlements", entitlement._id);
  }

  const hasMore = (await ctx.db.query("tryoutEntitlements").first()) !== null;

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
