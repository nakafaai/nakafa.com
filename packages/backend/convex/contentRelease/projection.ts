import {
  type ContentProjection,
  familyForProjection,
} from "@nakafa/aksara-contracts/projection/spec";
import {
  MAX_PROJECTION_BATCH_BYTES,
  MAX_PROJECTION_BATCH_COUNT,
} from "@nakafa/aksara-contracts/transport/limits";
import { StageProjectionBatchInputSchema } from "@nakafa/aksara-contracts/transport/request";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
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
  decodeItemJson,
  decodeProjectionJson,
  decodeReleaseJson,
  encodeProjectionJson,
} from "@repo/backend/convex/contentRelease/parse";
import { getConvexSize } from "convex/values";
import { Effect, Schema } from "effect";

/** Decodes one bounded projection batch through the shared wire contract. */
const decodeBatch = Effect.fn("contentRelease.decodeProjectionBatch")(
  function* (
    releaseId: string,
    batchIndex: number,
    projectionJson: readonly string[]
  ) {
    if (
      projectionJson.length === 0 ||
      projectionJson.length > MAX_PROJECTION_BATCH_COUNT ||
      getConvexSize({
        batchIndex,
        projectionJson: [...projectionJson],
        releaseId,
      }) > MAX_PROJECTION_BATCH_BYTES
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_LIMIT",
        `Projection batch ${batchIndex} exceeds its bounded transport contract.`
      );
    }
    const projections = yield* Effect.forEach(
      projectionJson,
      decodeProjectionJson
    );
    return yield* Schema.decodeUnknown(StageProjectionBatchInputSchema)({
      batchIndex,
      projections,
      releaseId,
    }).pipe(
      Effect.mapError(
        () =>
          new ReleaseError({
            code: "CONTENT_RELEASE_INTEGRITY",
            message: `Projection batch ${batchIndex} violates its exact contract.`,
          })
      )
    );
  }
);

/** Confirms one projection belongs to its exact staged upsert. */
const stageProjection = Effect.fn("contentRelease.stageProjection")(function* (
  ctx: MutationCtx,
  releaseId: string,
  batchIndex: number,
  batchHash: string,
  projection: ContentProjection,
  projectionJson: string
) {
  const item = yield* loadIdentityItem(
    ctx,
    releaseId,
    projection.contentKey,
    projection.locale
  );
  if (!item) {
    return yield* releaseFail(
      "CONTENT_RELEASE_MISSING",
      `Projection ${projection.contentKey}/${projection.locale} has no staged item.`
    );
  }
  if (item.projectionReady) {
    return yield* releaseFail(
      "CONTENT_RELEASE_CONFLICT",
      `Projection ${projection.contentKey}/${projection.locale} was already staged in another batch.`
    );
  }
  const decodedItem = yield* decodeItemJson(item.itemJson);
  if (
    decodedItem.change.operation !== "upsert" ||
    decodedItem.change.family !== familyForProjection(projection)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Projection ${projection.contentKey}/${projection.locale} does not match its staged upsert.`
    );
  }
  const itemPatch = {
    projectionBatchHash: batchHash,
    projectionBatchIndex: batchIndex,
    projectionJson,
    projectionReady: true,
  };
  yield* ensureDocumentSize(`Projected release item ${item.index}`, {
    ...item,
    ...itemPatch,
  });
  yield* Effect.promise(() =>
    ctx.db.patch("contentItems", item._id, {
      ...itemPatch,
      projectionJson,
    })
  );
});

/** Stages one canonical projection batch with exact retry identity. */
export const stageProjectionProgram = Effect.fn(
  "contentRelease.stageProjectionBatch"
)(function* (
  ctx: MutationCtx,
  releaseId: string,
  batchIndex: number,
  sources: readonly string[]
) {
  const { projections } = yield* decodeBatch(releaseId, batchIndex, sources);
  const entries = projections.map((projection) => ({
    projection,
    projectionJson: encodeProjectionJson(projection),
  }));
  const values = entries.map(({ projectionJson }) => projectionJson);
  const identities = new Set(
    projections.map(({ contentKey, locale }) => `${contentKey}\0${locale}`)
  );
  if (identities.size !== projections.length) {
    return yield* releaseFail(
      "CONTENT_RELEASE_CONFLICT",
      `Projection batch ${batchIndex} repeats one content head.`
    );
  }
  const batchHash = yield* hashBatch(
    "projection",
    releaseId,
    batchIndex,
    values
  );
  const { release } = yield* loadStaged(ctx, releaseId);
  const signed = yield* decodeReleaseJson(release.releaseJson);
  if (release.status !== "staging" || release.abortingAt !== undefined) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Content release ${releaseId} no longer accepts projection batches.`
    );
  }
  const existing = yield* Effect.promise(() =>
    ctx.db
      .query("contentItems")
      .withIndex("by_releaseId_and_projectionBatchIndex", (query) =>
        query.eq("releaseId", releaseId).eq("projectionBatchIndex", batchIndex)
      )
      .take(MAX_PROJECTION_BATCH_COUNT + 1)
  );
  if (existing.length > 0) {
    yield* validateStoredBatch(
      existing.length,
      values.length,
      existing.map(({ projectionBatchHash }) => projectionBatchHash),
      batchHash,
      releaseId,
      batchIndex
    );
    return {
      batchIndex,
      created: 0,
      releaseId,
      unchanged: values.length,
    };
  }
  if (
    release.stagedProjections + values.length >
    signed.manifest.projectionCount
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Projection batch ${batchIndex} exceeds the signed projection count.`
    );
  }
  for (const { projection, projectionJson } of entries) {
    yield* stageProjection(
      ctx,
      releaseId,
      batchIndex,
      batchHash,
      projection,
      projectionJson
    );
  }
  yield* Effect.promise(() =>
    ctx.db.patch("contentReleases", release._id, {
      stagedProjections: release.stagedProjections + values.length,
      updatedAt: Date.now(),
    })
  );
  return {
    batchIndex,
    created: values.length,
    releaseId,
    unchanged: 0,
  };
});
