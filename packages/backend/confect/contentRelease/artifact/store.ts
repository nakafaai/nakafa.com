import type { SignedContentArtifact } from "@nakafa/aksara-contracts/content";
import { MAX_SIGNED_ARTIFACT_BYTES } from "@nakafa/aksara-contracts/limits";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { ensureDocumentSize } from "@repo/backend/confect/contentRelease/document";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { Effect } from "effect";

/**
 * Stores one authenticated content-addressed artifact without release coupling.
 *
 * A reused hash is proven byte-identical with one read and left untouched. Its
 * staged item already references it, and retention starts only after the
 * final reference is removed, so rewriting the row would only re-read its body.
 */
export const storeContentArtifact = Effect.fn(
  "contentRelease.storeContentArtifact"
)(function* (
  artifact: SignedContentArtifact,
  artifactJson: string,
  createdAt: number,
  retainUntil: number
) {
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  if (
    new TextEncoder().encode(artifactJson).byteLength >
    MAX_SIGNED_ARTIFACT_BYTES
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_SIZE",
      `Artifact ${artifact.artifactHash} exceeds its signed wire ceiling.`
    );
  }
  const row = {
    artifactHash: artifact.artifactHash,
    artifactJson,
    createdAt,
    retainUntil,
  };
  yield* ensureDocumentSize(`Artifact ${artifact.artifactHash}`, row);
  const stored = yield* database
    .table("contentArtifacts")
    .get("by_artifactHash", artifact.artifactHash)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  if (stored && stored.artifactJson !== artifactJson) {
    return yield* releaseFail(
      "CONTENT_RELEASE_CONFLICT",
      `Artifact hash ${artifact.artifactHash} was reused with different bytes.`
    );
  }
  if (!stored) {
    yield* writer.table("contentArtifacts").insert(row).pipe(Effect.orDie);
    return false;
  }
  return true;
});
