import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { retainOrphanedArtifacts } from "@repo/backend/convex/contentRelease/retention";
import { RELEASE_PAGE_LIMIT } from "@repo/backend/convex/contentRelease/spec";
import { Effect } from "effect";

interface AbortCounts {
  readonly checkedItems: number;
  readonly stagedItems: number;
  readonly stagedRoutes: number;
  readonly stagedSnapshotBatches: number;
}

/** Counts durable release-owned rows processed by an abort. */
export function abortRowCount(release: AbortCounts) {
  return (
    release.checkedItems +
    release.stagedItems +
    release.stagedRoutes +
    release.stagedSnapshotBatches
  );
}

/** Removes a directory key only when this release created its identity. */
const deleteOwnedKey = Effect.fn("contentRelease.deleteAbortKey")(function* (
  ctx: MutationCtx,
  contentKey: string,
  locale: Doc<"contentKeys">["locale"],
  sequence: number
) {
  const key = yield* Effect.promise(() =>
    ctx.db
      .query("contentKeys")
      .withIndex("by_contentKey_and_locale", (query) =>
        query.eq("contentKey", contentKey).eq("locale", locale)
      )
      .unique()
  );
  if (key?.createdSequence === sequence) {
    yield* Effect.promise(() => ctx.db.delete("contentKeys", key._id));
  }
});

/** Removes a route identity only when this release first introduced it. */
const deleteOwnedPath = Effect.fn("contentRelease.deleteAbortPath")(function* (
  ctx: MutationCtx,
  locale: Doc<"contentPaths">["locale"],
  publicPath: string,
  sequence: number
) {
  const path = yield* Effect.promise(() =>
    ctx.db
      .query("contentPaths")
      .withIndex("by_locale_and_publicPath", (query) =>
        query.eq("locale", locale).eq("publicPath", publicPath)
      )
      .unique()
  );
  if (path?.createdSequence === sequence) {
    yield* Effect.promise(() => ctx.db.delete("contentPaths", path._id));
  }
});

/** Checks whether an aborted sequence still owns a directory identity. */
export const hasAbortDirectories = Effect.fn(
  "contentRelease.hasAbortDirectories"
)(function* (ctx: MutationCtx | QueryCtx, sequence: number) {
  const [key, path] = yield* Effect.all([
    Effect.promise(() =>
      ctx.db
        .query("contentKeys")
        .withIndex("by_createdSequence_and_contentKey_and_locale", (query) =>
          query.eq("createdSequence", sequence)
        )
        .first()
    ),
    Effect.promise(() =>
      ctx.db
        .query("contentPaths")
        .withIndex("by_createdSequence_and_locale_and_publicPath", (query) =>
          query.eq("createdSequence", sequence)
        )
        .first()
    ),
  ]);
  return key !== null || path !== null;
});

/** Deletes one bounded release-owned page and its staged directory identities. */
export const deleteAbortRows = Effect.fn("contentRelease.deleteAbortRows")(
  function* (ctx: MutationCtx, releaseId: string, sequence: number) {
    const heads = yield* Effect.promise(() =>
      ctx.db
        .query("contentHeads")
        .withIndex("by_releaseId_and_index", (query) =>
          query.eq("releaseId", releaseId)
        )
        .take(RELEASE_PAGE_LIMIT)
    );
    let remaining = RELEASE_PAGE_LIMIT - heads.length;
    const bindings =
      remaining === 0
        ? []
        : yield* Effect.promise(() =>
            ctx.db
              .query("contentBindings")
              .withIndex("by_releaseId_and_index", (query) =>
                query.eq("releaseId", releaseId)
              )
              .take(remaining)
          );
    remaining -= bindings.length;
    const items =
      remaining === 0
        ? []
        : yield* Effect.promise(() =>
            ctx.db
              .query("contentItems")
              .withIndex("by_releaseId_and_index", (query) =>
                query.eq("releaseId", releaseId)
              )
              .take(remaining)
          );
    remaining -= items.length;
    const batches =
      remaining === 0
        ? []
        : yield* Effect.promise(() =>
            ctx.db
              .query("snapshotBatches")
              .withIndex("by_releaseId_and_family_and_batchIndex", (query) =>
                query.eq("releaseId", releaseId)
              )
              .take(remaining)
          );
    for (const row of heads) {
      yield* Effect.promise(() => ctx.db.delete("contentHeads", row._id));
    }
    for (const row of bindings) {
      yield* deleteOwnedPath(ctx, row.locale, row.publicPath, sequence);
      yield* Effect.promise(() => ctx.db.delete("contentBindings", row._id));
    }
    for (const row of items) {
      yield* deleteOwnedKey(ctx, row.contentKey, row.locale, sequence);
      yield* Effect.promise(() => ctx.db.delete("contentItems", row._id));
    }
    yield* Effect.forEach(batches, (row) =>
      Effect.promise(() => ctx.db.delete("snapshotBatches", row._id))
    );
    yield* retainOrphanedArtifacts(
      ctx,
      [...heads, ...items].flatMap(({ artifactHash }) =>
        artifactHash === undefined ? [] : [artifactHash]
      )
    );
    return heads.length + bindings.length + items.length + batches.length;
  }
);
