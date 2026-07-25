import type { SignedContentArtifact } from "@nakafa/aksara-contracts/content";
import { MAX_SIGNED_ARTIFACT_BYTES } from "@nakafa/aksara-contracts/limits";
import {
  MAX_ARTIFACT_BATCH_BYTES,
  MAX_ARTIFACT_BATCH_COUNT,
} from "@nakafa/aksara-contracts/transport/limits";
import { StageArtifactBatchInputSchema } from "@nakafa/aksara-contracts/transport/request";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import {
  hashBatch,
  validateStoredBatch,
} from "@repo/backend/convex/contentRelease/batch";
import { ensureDocumentSize } from "@repo/backend/convex/contentRelease/document";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import {
  loadIdentityItem,
  loadStaged,
} from "@repo/backend/convex/contentRelease/model";
import {
  decodeArtifactJson,
  decodeItemJson,
} from "@repo/backend/convex/contentRelease/parse";
import {
  ROLLBACK_RETENTION_MS,
  stageReceiptValidator,
} from "@repo/backend/convex/contentRelease/spec";
import { encodeArtifactJson } from "@repo/backend/convex/contentRelease/wire";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { getConvexSize, v } from "convex/values";
import { Effect, Schema } from "effect";

/** Decodes one bounded artifact batch through the shared wire contract. */
const decodeBatch = Effect.fn("contentRelease.decodeArtifactBatch")(function* (
  releaseId: string,
  batchIndex: number,
  artifactJson: readonly string[]
) {
  if (
    artifactJson.length === 0 ||
    artifactJson.length > MAX_ARTIFACT_BATCH_COUNT ||
    getConvexSize({ artifactJson: [...artifactJson], batchIndex, releaseId }) >
      MAX_ARTIFACT_BATCH_BYTES
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Artifact batch ${batchIndex} exceeds its bounded transport contract.`
    );
  }
  const artifacts = yield* Effect.forEach(artifactJson, decodeArtifactJson);
  return yield* Schema.decodeUnknown(StageArtifactBatchInputSchema)({
    artifacts,
    batchIndex,
    releaseId,
  }).pipe(
    Effect.mapError(
      () =>
        new ReleaseError({
          code: "CONTENT_RELEASE_INTEGRITY",
          message: `Artifact batch ${batchIndex} violates its exact contract.`,
        })
    )
  );
});

/** Persists one immutable artifact and marks its exact staged item ready. */
const stageArtifact = Effect.fn("contentRelease.stageArtifact")(function* (
  ctx: MutationCtx,
  releaseId: string,
  batchIndex: number,
  batchHash: string,
  artifact: SignedContentArtifact,
  artifactJson: string,
  now: number
) {
  const item = yield* loadIdentityItem(
    ctx,
    releaseId,
    artifact.payload.contentKey,
    artifact.payload.locale
  );
  if (!item) {
    return yield* releaseFail(
      "CONTENT_RELEASE_MISSING",
      `Artifact ${artifact.artifactHash} has no staged item.`
    );
  }
  if (item.artifactReady) {
    return yield* releaseFail(
      "CONTENT_RELEASE_CONFLICT",
      `Artifact ${artifact.artifactHash} was already staged in another batch.`
    );
  }
  const decodedItem = yield* decodeItemJson(item.itemJson);
  if (
    decodedItem.change.operation !== "upsert" ||
    decodedItem.change.artifactHash !== artifact.artifactHash ||
    decodedItem.change.rendererDomain !== artifact.payload.rendererDomain
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Artifact ${artifact.artifactHash} does not match its staged upsert.`
    );
  }
  if (
    new TextEncoder().encode(artifactJson).byteLength >
    MAX_SIGNED_ARTIFACT_BYTES
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_SIZE",
      `Artifact ${artifact.artifactHash} exceeds its signed wire ceiling.`
    );
  }
  const retainUntil = now + ROLLBACK_RETENTION_MS;
  const row = {
    artifactHash: artifact.artifactHash,
    artifactJson,
    createdAt: now,
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
  } else if (stored.retainUntil < retainUntil) {
    yield* Effect.promise(() =>
      ctx.db.patch("contentArtifacts", stored._id, { retainUntil })
    );
  }
  yield* Effect.promise(() =>
    ctx.db.patch("contentItems", item._id, {
      artifactBatchHash: batchHash,
      artifactBatchIndex: batchIndex,
      artifactReady: true,
    })
  );
  return stored !== null;
});

/** Stages one canonical artifact batch with exact immutable retry identity. */
const stageProgram = Effect.fn("contentRelease.stageArtifactBatch")(function* (
  ctx: MutationCtx,
  releaseId: string,
  batchIndex: number,
  sources: readonly string[]
) {
  const { artifacts } = yield* decodeBatch(releaseId, batchIndex, sources);
  const entries = artifacts.map((artifact) => ({
    artifact,
    artifactJson: encodeArtifactJson(artifact),
  }));
  const values = entries.map(({ artifactJson }) => artifactJson);
  const identities = new Set(artifacts.map(({ artifactHash }) => artifactHash));
  if (identities.size !== artifacts.length) {
    return yield* releaseFail(
      "CONTENT_RELEASE_CONFLICT",
      `Artifact batch ${batchIndex} repeats one immutable hash.`
    );
  }
  const batchHash = yield* hashBatch("artifact", releaseId, batchIndex, values);
  const { release } = yield* loadStaged(ctx, releaseId);
  if (release.status !== "staging" || release.abortingAt !== undefined) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Content release ${releaseId} no longer accepts artifact batches.`
    );
  }
  const existing = yield* Effect.promise(() =>
    ctx.db
      .query("contentItems")
      .withIndex("by_releaseId_and_artifactBatchIndex", (query) =>
        query.eq("releaseId", releaseId).eq("artifactBatchIndex", batchIndex)
      )
      .take(MAX_ARTIFACT_BATCH_COUNT + 1)
  );
  if (existing.length > 0) {
    yield* validateStoredBatch(
      existing.length,
      values.length,
      existing.map(({ artifactBatchHash }) => artifactBatchHash),
      batchHash,
      releaseId,
      batchIndex
    );
    return { batchIndex, created: 0, releaseId, unchanged: values.length };
  }
  if (release.stagedArtifacts + values.length > release.stagedUpserts) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Artifact batch ${batchIndex} exceeds staged upserts.`
    );
  }
  const now = Date.now();
  let unchanged = 0;
  for (const { artifact, artifactJson } of entries) {
    if (
      yield* stageArtifact(
        ctx,
        releaseId,
        batchIndex,
        batchHash,
        artifact,
        artifactJson,
        now
      )
    ) {
      unchanged += 1;
    }
  }
  yield* Effect.promise(() =>
    ctx.db.patch("contentReleases", release._id, {
      stagedArtifacts: release.stagedArtifacts + values.length,
      updatedAt: now,
    })
  );
  return {
    batchIndex,
    created: values.length - unchanged,
    releaseId,
    unchanged,
  };
});

/** Stages one bounded immutable artifact batch through internal state. */
export const stageArtifactBatch = internalMutation({
  args: {
    artifactJson: v.array(v.string()),
    batchIndex: v.number(),
    releaseId: v.string(),
  },
  returns: stageReceiptValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      stageProgram(ctx, args.releaseId, args.batchIndex, args.artifactJson)
    ),
});
