import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { deleteUnreferencedArchiveStorage } from "@repo/backend/convex/contentRelease/archive/model";
import { MAX_CONTENT_RUNTIME_ARCHIVES } from "@repo/backend/convex/contentRelease/archive/spec";
import { ROLLBACK_RETENTION_MS } from "@repo/backend/convex/contentRelease/spec";
import { Effect } from "effect";

/** Prunes expired archives first, then bounds retained rollback history. */
export const pruneArchives = Effect.fn("contentRuntimeArchive.prune")(
  function* (ctx: MutationCtx, now: number) {
    const [archives, newest] = yield* Effect.all([
      Effect.promise(() =>
        ctx.db
          .query("contentRuntimeArchives")
          .withIndex("by_createdAt")
          .order("asc")
          .take(MAX_CONTENT_RUNTIME_ARCHIVES + 1)
      ),
      Effect.promise(() =>
        ctx.db
          .query("contentRuntimeArchives")
          .withIndex("by_createdAt")
          .order("desc")
          .first()
      ),
    ]);
    const cutoff = now - ROLLBACK_RETENTION_MS;
    const retained = archives.filter((archive) => archive.createdAt >= cutoff);
    const overflow = Math.max(
      0,
      retained.length - MAX_CONTENT_RUNTIME_ARCHIVES
    );
    const removals = [
      ...archives.filter((archive) => archive.createdAt < cutoff),
      ...retained.slice(0, overflow),
    ].filter((archive) => archive._id !== newest?._id);

    for (const archive of removals) {
      yield* Effect.promise(() => ctx.db.delete(archive._id));
      yield* deleteUnreferencedArchiveStorage(ctx, archive.storageId);
    }
    return removals.length;
  }
);
