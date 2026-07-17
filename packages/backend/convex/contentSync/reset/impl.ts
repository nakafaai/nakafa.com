import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  contentSearchResetBatchSize,
  type ResettableTableName,
  resetBatchSize,
} from "@repo/backend/convex/contentSync/reset/spec";
import { Effect } from "effect";

/** Deletes one bounded batch from a resettable content-derived table. */
export const deleteBatchFromTable = Effect.fn(
  "contentSync.reset.deleteBatchFromTable"
)(function* (ctx: MutationCtx, tableName: ResettableTableName) {
  const docs = yield* Effect.promise(() =>
    ctx.db.query(tableName).take(resetBatchSize)
  );
  let deleted = 0;

  for (const doc of docs) {
    yield* Effect.promise(() => ctx.db.delete(tableName, doc._id));
    deleted += 1;
  }

  const remaining = yield* Effect.promise(() =>
    ctx.db.query(tableName).first()
  );

  return { deleted, hasMore: remaining !== null };
});

/**
 * Deletes one small batch of full-text search rows.
 *
 * Search documents can contain large MDX text payloads, so the generic reset
 * batch can exceed Convex's per-function read byte limit before the reset loop
 * gets a chance to continue.
 */
export const deleteContentSearchRows = Effect.fn(
  "contentSync.reset.deleteContentSearchRows"
)(function* (ctx: MutationCtx) {
  const docs = yield* Effect.promise(() =>
    ctx.db.query("contentSearch").take(contentSearchResetBatchSize)
  );
  let deleted = 0;

  for (const doc of docs) {
    yield* Effect.promise(() => ctx.db.delete(doc._id));
    deleted += 1;
  }

  const remaining = yield* Effect.promise(() =>
    ctx.db.query("contentSearch").first()
  );

  return { deleted, hasMore: remaining !== null };
});

/**
 * Deletes generated audio rows with their Convex storage blobs.
 *
 * @see https://docs.convex.dev/file-storage/delete-files
 */
export const deleteContentAudioRows = Effect.fn(
  "contentSync.reset.deleteContentAudioRows"
)(function* (ctx: MutationCtx) {
  const audios = yield* Effect.promise(() =>
    ctx.db.query("contentAudios").take(resetBatchSize)
  );
  let deleted = 0;

  for (const audio of audios) {
    const storageId = audio.audioStorageId;

    if (storageId) {
      const metadata = yield* Effect.promise(() =>
        ctx.db.system.get("_storage", storageId)
      );

      if (metadata) {
        yield* Effect.promise(() => ctx.storage.delete(storageId));
      }
    }

    yield* Effect.promise(() => ctx.db.delete("contentAudios", audio._id));
    deleted += 1;
  }

  const remaining = yield* Effect.promise(() =>
    ctx.db.query("contentAudios").first()
  );

  return { deleted, hasMore: remaining !== null };
});
