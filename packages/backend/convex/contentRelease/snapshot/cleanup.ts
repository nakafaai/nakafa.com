import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { isSnapshotReferenced } from "@repo/backend/convex/contentRelease/snapshot/retention";
import {
  deleteSnapshotChild,
  loadSnapshotChildren,
} from "@repo/backend/convex/contentRelease/snapshot/rows";
import { ROLLBACK_RETENTION_MS } from "@repo/backend/convex/contentRelease/spec";
import { Effect } from "effect";

/** Reads one resumable or newly expired immutable snapshot. */
const loadExpiredSnapshot = Effect.fn("contentRelease.loadExpiredSnapshot")(
  function* (ctx: MutationCtx, cutoff: number) {
    const retry = yield* Effect.promise(() =>
      ctx.db
        .query("contentSnapshots")
        .withIndex("by_cleanupRetryAt_and_family_and_snapshotId", (query) =>
          query.gt("cleanupRetryAt", undefined).lte("cleanupRetryAt", cutoff)
        )
        .first()
    );
    if (retry) {
      return retry;
    }
    return yield* Effect.promise(() =>
      ctx.db
        .query("contentSnapshots")
        .withIndex("by_retainUntil_and_family_and_snapshotId", (query) =>
          query.lte("retainUntil", cutoff)
        )
        .first()
    );
  }
);

/** Persists one incomplete physical cleanup page. */
const persistCleanup = Effect.fn("contentRelease.persistSnapshotCleanup")(
  function* (
    ctx: MutationCtx,
    snapshot: Doc<"contentSnapshots">,
    cutoff: number,
    cleanupIndex: number | undefined,
    cleanupPart: Doc<"contentSnapshots">["cleanupPart"]
  ) {
    yield* Effect.promise(() =>
      ctx.db.patch("contentSnapshots", snapshot._id, {
        cleanupAt: snapshot.cleanupAt ?? cutoff,
        cleanupIndex,
        cleanupPart,
        cleanupRetryAt: cutoff,
      })
    );
  }
);

/** Deletes one bounded snapshot page without exposing partial data. */
export const compactSnapshots = Effect.fn("contentRelease.compactSnapshots")(
  function* (ctx: MutationCtx, cutoff: number) {
    const snapshot = yield* loadExpiredSnapshot(ctx, cutoff);
    if (!snapshot) {
      return { cursor: null, deleted: 0, done: true };
    }
    const referenced = yield* isSnapshotReferenced(
      ctx,
      snapshot.family,
      snapshot.snapshotId
    );
    if (referenced) {
      if (snapshot.cleanupAt !== undefined) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Snapshot ${snapshot.family}/${snapshot.snapshotId} became referenced during cleanup.`
        );
      }
      yield* Effect.promise(() =>
        ctx.db.patch("contentSnapshots", snapshot._id, {
          retainUntil: cutoff + ROLLBACK_RETENTION_MS,
        })
      );
      return { cursor: null, deleted: 0, done: false };
    }
    const children = yield* loadSnapshotChildren(
      ctx,
      snapshot.family,
      snapshot.snapshotId,
      snapshot.cleanupIndex ?? -1,
      snapshot.cleanupPart
    );
    for (const child of children.children) {
      yield* deleteSnapshotChild(ctx, child);
    }
    if (!children.done) {
      const last = children.children.at(-1);
      if (!last) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Snapshot ${snapshot.family}/${snapshot.snapshotId} lost its cleanup page.`
        );
      }
      yield* persistCleanup(
        ctx,
        snapshot,
        cutoff,
        last.row.index,
        children.part
      );
      return {
        cursor: null,
        deleted: children.children.length,
        done: false,
      };
    }
    if (snapshot.family === "program" && children.part === "program") {
      yield* persistCleanup(ctx, snapshot, cutoff, undefined, "curriculum");
      return {
        cursor: null,
        deleted: children.children.length,
        done: false,
      };
    }
    if (snapshot.family === "program" && children.part === "curriculum") {
      yield* persistCleanup(ctx, snapshot, cutoff, undefined, "bucket");
      return {
        cursor: null,
        deleted: children.children.length,
        done: false,
      };
    }
    if (snapshot.family === "quran" && children.part === "quran") {
      yield* persistCleanup(ctx, snapshot, cutoff, undefined, "quran-search");
      return {
        cursor: null,
        deleted: children.children.length,
        done: false,
      };
    }
    if (snapshot.family === "tryout" && children.part === "catalog") {
      yield* persistCleanup(ctx, snapshot, cutoff, undefined, "placement");
      return {
        cursor: null,
        deleted: children.children.length,
        done: false,
      };
    }
    if (snapshot.family === "tryout" && children.part === "placement") {
      yield* persistCleanup(ctx, snapshot, cutoff, undefined, "bundle");
      return {
        cursor: null,
        deleted: children.children.length,
        done: false,
      };
    }
    yield* Effect.promise(() =>
      ctx.db.delete("contentSnapshots", snapshot._id)
    );
    return {
      cursor: null,
      deleted: children.children.length + 1,
      done: false,
    };
  }
);
