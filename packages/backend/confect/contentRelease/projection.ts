import { DatabaseReader, DatabaseWriter } from "@confect/server";
import {
  type ContentProjection,
  familyForProjection,
  projectionArtifactLocale,
} from "@nakafa/aksara-contracts/projection/spec";
import { StageProjectionBatchInputSchema } from "@nakafa/aksara-contracts/transport/batch";
import {
  MAX_PROJECTION_BATCH_BYTES,
  MAX_PROJECTION_BATCH_COUNT,
} from "@nakafa/aksara-contracts/transport/limits";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  hashBatch,
  validateStoredBatch,
} from "@repo/backend/confect/contentRelease/batch";
import { ensureDocumentSize } from "@repo/backend/confect/contentRelease/document";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/confect/contentRelease/error";
import {
  loadIdentityItem,
  loadStaged,
} from "@repo/backend/confect/contentRelease/model";
import {
  decodeItemJson,
  decodeProjectionJson,
  decodeReleaseJson,
} from "@repo/backend/confect/contentRelease/parse";
import { encodeProjectionJson } from "@repo/backend/confect/contentRelease/wire";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { getConvexSize } from "convex/values";
import { Clock, Effect, Schema } from "effect";

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
    return yield* Schema.decodeUnknownEffect(StageProjectionBatchInputSchema)({
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
  const writer = DatabaseWriter.make(databaseSchema, ctx.db);
  const item = yield* loadIdentityItem(
    ctx,
    releaseId,
    projection.contentKey,
    projectionArtifactLocale(projection)
  );
  const artifactLocale = projectionArtifactLocale(projection);
  if (!item) {
    return yield* releaseFail(
      "CONTENT_RELEASE_MISSING",
      `Projection ${projection.contentKey}/${artifactLocale} has no staged item.`
    );
  }
  if (item.projectionReady) {
    return yield* releaseFail(
      "CONTENT_RELEASE_CONFLICT",
      `Projection ${projection.contentKey}/${artifactLocale} was already staged in another batch.`
    );
  }
  const decodedItem = yield* decodeItemJson(item.itemJson);
  if (
    decodedItem.change.operation !== "upsert" ||
    decodedItem.change.family !== familyForProjection(projection)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Projection ${projection.contentKey}/${artifactLocale} does not match its staged upsert.`
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
  yield* writer
    .table("contentItems")
    .patch(item._id, itemPatch)
    .pipe(Effect.orDie);
});
/** Stages one content projection batch with exact retry identity. */
export const stageProjectionProgram = Effect.fn(
  "contentRelease.stageProjectionBatch"
)(function* (
  ctx: MutationCtx,
  releaseId: string,
  batchIndex: number,
  sources: readonly string[]
) {
  const database = DatabaseReader.make(databaseSchema, ctx.db);
  const writer = DatabaseWriter.make(databaseSchema, ctx.db);
  const { release } = yield* loadStaged(ctx, releaseId);
  const signed = yield* decodeReleaseJson(release.releaseJson);
  if (release.status !== "staging" || release.abortingAt !== undefined) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Content release ${releaseId} does not accept ${release.role} projection batches.`
    );
  }
  const batch = yield* decodeBatch(releaseId, batchIndex, sources);
  const projections: readonly ContentProjection[] = batch.projections;
  const entries = projections.map((projection) => ({
    projection,
    projectionJson: encodeProjectionJson(projection),
  }));
  const values = entries.map(({ projectionJson }) => projectionJson);
  const identities = new Set(
    projections.map(
      (projection) =>
        `${projection.contentKey}\0${projectionArtifactLocale(projection)}`
    )
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
  const existing = yield* database
    .table("contentItems")
    .index("by_releaseId_and_projectionBatchIndex", (query) =>
      query.eq("releaseId", releaseId).eq("projectionBatchIndex", batchIndex)
    )
    .take(MAX_PROJECTION_BATCH_COUNT + 1)
    .pipe(Effect.orDie);
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
  yield* writer
    .table("contentReleases")
    .patch(release._id, {
      stagedProjections: release.stagedProjections + values.length,
      updatedAt: yield* Clock.currentTimeMillis,
    })
    .pipe(Effect.orDie);
  return {
    batchIndex,
    created: values.length,
    releaseId,
    unchanged: 0,
  };
});
