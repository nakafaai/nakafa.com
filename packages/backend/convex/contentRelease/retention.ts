import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { hasSnapshotArtifactReference } from "@repo/backend/convex/contentRelease/snapshot/retention";
import { ROLLBACK_RETENTION_MS } from "@repo/backend/convex/contentRelease/spec";
import { Effect } from "effect";

/** Checks whether any retained immutable version still owns an artifact. */
export const isArtifactReferenced = Effect.fn(
  "contentRelease.isArtifactReferenced"
)(function* (ctx: MutationCtx, artifactHash: string) {
  const [head, item, snapshot] = yield* Effect.all([
    Effect.promise(() =>
      ctx.db
        .query("contentHeads")
        .withIndex("by_artifactHash_and_sequence", (query) =>
          query.eq("artifactHash", artifactHash)
        )
        .first()
    ),
    Effect.promise(() =>
      ctx.db
        .query("contentItems")
        .withIndex("by_artifactHash", (query) =>
          query.eq("artifactHash", artifactHash)
        )
        .first()
    ),
    hasSnapshotArtifactReference(ctx, artifactHash),
  ]);
  return head !== null || item !== null || snapshot;
});

/** Starts retention when deleting rows removes an artifact's final reference. */
export const retainOrphanedArtifacts = Effect.fn(
  "contentRelease.retainOrphanedArtifacts"
)(function* (
  ctx: MutationCtx,
  artifactHashes: Iterable<string>,
  now = Date.now()
) {
  const hashes = [...new Set(artifactHashes)];
  for (const artifactHash of hashes) {
    if (yield* isArtifactReferenced(ctx, artifactHash)) {
      continue;
    }
    const artifact = yield* Effect.promise(() =>
      ctx.db
        .query("contentArtifacts")
        .withIndex("by_artifactHash", (query) =>
          query.eq("artifactHash", artifactHash)
        )
        .unique()
    );
    const retainUntil = now + ROLLBACK_RETENTION_MS;
    if (artifact && artifact.retainUntil < retainUntil) {
      yield* Effect.promise(() =>
        ctx.db.patch("contentArtifacts", artifact._id, { retainUntil })
      );
    }
  }
});
