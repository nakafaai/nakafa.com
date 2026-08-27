import type { SignedContentArtifact } from "@nakafa/aksara-contracts/content";
import { MAX_SIGNED_ARTIFACT_BYTES } from "@nakafa/aksara-contracts/limits";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { ensureDocumentSize } from "@repo/backend/convex/contentRelease/document";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
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
  const stored = yield* Effect.promise(() =>
    ctx.db
      .query("contentArtifacts")
      .withIndex("by_artifactHash", (query) =>
        query.eq("artifactHash", artifact.artifactHash)
      )
      .unique()
  );
  if (stored && stored.artifactJson !== artifactJson) {
    return yield* releaseFail(
      "CONTENT_RELEASE_CONFLICT",
      `Artifact hash ${artifact.artifactHash} was reused with different bytes.`
    );
  }
  if (!stored) {
    yield* Effect.promise(() => ctx.db.insert("contentArtifacts", row));
    return false;
  }
  if (stored.retainUntil < retainUntil) {
    yield* Effect.promise(() =>
      ctx.db.patch("contentArtifacts", stored._id, { retainUntil })
    );
  }
  return true;
});
