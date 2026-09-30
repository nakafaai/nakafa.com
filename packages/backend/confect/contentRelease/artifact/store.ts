import type { SignedContentArtifact } from "@nakafa/aksara-contracts/content";
import { MAX_SIGNED_ARTIFACT_BYTES } from "@nakafa/aksara-contracts/limits";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { loadArtifactFacts } from "@repo/backend/confect/contentRelease/artifact/facts";
import { hashText } from "@repo/backend/confect/contentRelease/digest";
import { ensureDocumentSize } from "@repo/backend/confect/contentRelease/document";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { Effect } from "effect";

/**
 * Stores one authenticated content-addressed artifact without release coupling.
 *
 * A reused hash is proven byte-identical by the digest in its small facts, so
 * staging never reads or rewrites a stored body. Its staged item already
 * references it, and retention starts only after the final reference is removed.
 */
export const storeContentArtifact = Effect.fn(
  "contentRelease.storeContentArtifact"
)(function* (
  artifact: SignedContentArtifact,
  artifactJson: string,
  retainUntil: number
) {
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const { artifactHash } = artifact;
  if (
    new TextEncoder().encode(artifactJson).byteLength >
    MAX_SIGNED_ARTIFACT_BYTES
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_SIZE",
      `Artifact ${artifactHash} exceeds its signed wire ceiling.`
    );
  }
  const body = { artifactHash, artifactJson };
  yield* ensureDocumentSize(`Artifact ${artifactHash}`, body);
  const artifactJsonHash = yield* hashText(
    `artifact ${artifactHash} bytes`,
    artifactJson
  );
  const facts = yield* loadArtifactFacts(artifactHash);
  if (facts) {
    if (facts.artifactJsonHash !== artifactJsonHash) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Artifact hash ${artifactHash} was reused with different bytes.`
      );
    }
    return true;
  }
  // Every stored body has facts, so this lookup finds nothing and reads no
  // document unless a body lost them; a second body would break its hash key.
  const stray = yield* database
    .table("contentArtifacts")
    .get("by_artifactHash", artifactHash)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  if (stray) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Artifact ${artifactHash} is stored without its facts.`
    );
  }
  const artifactId = yield* writer
    .table("contentArtifacts")
    .insert(body)
    .pipe(Effect.orDie);
  yield* writer
    .table("contentArtifactFacts")
    .insert({ artifactHash, artifactId, artifactJsonHash, retainUntil })
    .pipe(Effect.orDie);
  return false;
});
