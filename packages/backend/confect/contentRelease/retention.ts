import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { loadArtifactFacts } from "@repo/backend/confect/contentRelease/artifact/facts";
import { hasSnapshotArtifactReference } from "@repo/backend/confect/contentRelease/snapshot/retention";
import { ROLLBACK_RETENTION_MS } from "@repo/backend/confect/contentRelease/spec";
import { Array as Arr, Clock, Effect, Option } from "effect";

/** Checks whether any retained immutable version still owns an artifact. */
export const isArtifactReferenced = Effect.fn(
  "contentRelease.isArtifactReferenced"
)(function* (artifactHash: string) {
  const database = yield* DatabaseReader;
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
    hasSnapshotArtifactReference(artifactHash),
  ]);
  return head !== null || item !== null || snapshot;
});

/**
 * Starts retention when deleting rows removes an artifact's final reference.
 *
 * Retention lives only in the small artifact facts, never in the body.
 */
export const retainOrphanedArtifacts = Effect.fn(
  "contentRelease.retainOrphanedArtifacts"
)(function* (artifactHashes: Iterable<string>, now?: number) {
  const writer = yield* DatabaseWriter;
  const timestamp = now ?? (yield* Clock.currentTimeMillis);
  const hashes = Arr.dedupe(artifactHashes);
  for (const artifactHash of hashes) {
    if (yield* isArtifactReferenced(artifactHash)) {
      continue;
    }
    const facts = yield* loadArtifactFacts(artifactHash);
    const retainUntil = timestamp + ROLLBACK_RETENTION_MS;
    if (facts && facts.retainUntil < retainUntil) {
      yield* writer
        .table("contentArtifactFacts")
        .patch(facts._id, {
          retainUntil,
        })
        .pipe(Effect.orDie);
    }
  }
});
