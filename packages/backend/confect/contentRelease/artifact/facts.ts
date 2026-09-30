import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { Effect } from "effect";

/** Reads the small identity and retention facts of one stored artifact. */
export const loadArtifactFacts = Effect.fn("contentRelease.loadArtifactFacts")(
  function* (artifactHash: string) {
    return yield* (yield* DatabaseReader)
      .table("contentArtifactFacts")
      .get("by_artifactHash", artifactHash)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
  }
);

/** Deletes one stored artifact body together with the facts that own it. */
export const deleteStoredArtifact = Effect.fn(
  "contentRelease.deleteStoredArtifact"
)(function* (facts: Docs["contentArtifactFacts"]) {
  const writer = yield* DatabaseWriter;
  yield* writer.table("contentArtifacts").delete(facts.artifactId);
  yield* writer.table("contentArtifactFacts").delete(facts._id);
});
