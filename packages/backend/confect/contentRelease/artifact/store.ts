import { DatabaseReader, DatabaseWriter } from "@confect/server";
import type { SignedContentArtifact } from "@nakafa/aksara-contracts/content";
import { MAX_SIGNED_ARTIFACT_BYTES } from "@nakafa/aksara-contracts/limits";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { ensureDocumentSize } from "@repo/backend/confect/contentRelease/document";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Effect } from "effect";

/** Stores one authenticated content-addressed artifact without release coupling. */
export const storeContentArtifact = Effect.fn(
  "contentRelease.storeContentArtifact"
)(function* (
  ctx: MutationCtx,
  artifact: SignedContentArtifact,
  artifactJson: string,
  createdAt: number,
  retainUntil: number
) {
  const database = DatabaseReader.make(databaseSchema, ctx.db);
  const writer = DatabaseWriter.make(databaseSchema, ctx.db);
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
  if (stored.retainUntil < retainUntil) {
    yield* writer
      .table("contentArtifacts")
      .patch(stored._id, {
        retainUntil,
      })
      .pipe(Effect.orDie);
  }
  return true;
});
