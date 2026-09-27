import { DatabaseReader, DatabaseWriter } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { hasSnapshotArtifactReference } from "@repo/backend/confect/contentRelease/snapshot/retention";
import { ROLLBACK_RETENTION_MS } from "@repo/backend/confect/contentRelease/spec";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Clock, Effect, Option } from "effect";

/** Checks whether any retained immutable version still owns an artifact. */
export const isArtifactReferenced = Effect.fn(
  "contentRelease.isArtifactReferenced"
)(function* (ctx: MutationCtx, artifactHash: string) {
  const database = DatabaseReader.make(databaseSchema, ctx.db);
  const [head, item, snapshot] = yield* Effect.all([
    database
      .table("contentHeads")
      .index("by_artifactHash_and_sequence", (query) =>
        query.eq("artifactHash", artifactHash)
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie),
    database
      .table("contentItems")
      .index("by_artifactHash", (query) =>
        query.eq("artifactHash", artifactHash)
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie),
    hasSnapshotArtifactReference(ctx, artifactHash),
  ]);
  return head !== null || item !== null || snapshot;
});

/** Starts retention when deleting rows removes an artifact's final reference. */
export const retainOrphanedArtifacts = Effect.fn(
  "contentRelease.retainOrphanedArtifacts"
)(function* (ctx: MutationCtx, artifactHashes: Iterable<string>, now?: number) {
  const database = DatabaseReader.make(databaseSchema, ctx.db);
  const writer = DatabaseWriter.make(databaseSchema, ctx.db);
  const timestamp = now ?? (yield* Clock.currentTimeMillis);
  const hashes = [...new Set(artifactHashes)];
  for (const artifactHash of hashes) {
    if (yield* isArtifactReferenced(ctx, artifactHash)) {
      continue;
    }
    const artifact = yield* database
      .table("contentArtifacts")
      .get("by_artifactHash", artifactHash)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    const retainUntil = timestamp + ROLLBACK_RETENTION_MS;
    if (artifact && artifact.retainUntil < retainUntil) {
      yield* writer
        .table("contentArtifacts")
        .patch(artifact._id, {
          retainUntil,
        })
        .pipe(Effect.orDie);
    }
  }
});
