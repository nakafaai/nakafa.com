import { DatabaseReader, DatabaseWriter } from "@confect/server";
import { StageItemBatchInputSchema } from "@nakafa/aksara-contracts/transport/batch";
import {
  MAX_ITEM_BATCH_BYTES,
  MAX_ITEM_BATCH_COUNT,
} from "@nakafa/aksara-contracts/transport/limits";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  hashBatch,
  validateStoredBatch,
} from "@repo/backend/confect/contentRelease/batch";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/confect/contentRelease/error";
import { stageContentItem } from "@repo/backend/confect/contentRelease/item";
import {
  loadStaged,
  stagedBaseSequence,
} from "@repo/backend/confect/contentRelease/model";
import {
  decodeItemJson,
  decodeReleaseJson,
} from "@repo/backend/confect/contentRelease/parse";
import { encodeItemJson } from "@repo/backend/confect/contentRelease/wire";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { getConvexSize } from "convex/values";
import { Clock, Effect, Schema } from "effect";

/** Decodes one bounded item batch through the shared wire contract. */
export const decodeBatch = Effect.fn("contentRelease.decodeItemBatch")(
  function* (
    releaseId: string,
    batchIndex: number,
    itemJson: readonly string[]
  ) {
    if (
      itemJson.length === 0 ||
      itemJson.length > MAX_ITEM_BATCH_COUNT ||
      getConvexSize({
        batchIndex,
        itemJson: [...itemJson],
        releaseId,
      }) > MAX_ITEM_BATCH_BYTES
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_LIMIT",
        `Item batch ${batchIndex} exceeds its bounded transport contract.`
      );
    }
    const items = yield* Effect.forEach(itemJson, decodeItemJson);
    return yield* Schema.decodeUnknownEffect(StageItemBatchInputSchema)({
      batchIndex,
      items,
      releaseId,
    }).pipe(
      Effect.mapError(
        () =>
          new ReleaseError({
            code: "CONTENT_RELEASE_INTEGRITY",
            message: `Item batch ${batchIndex} violates its exact contract.`,
          })
      )
    );
  }
);
/** Stages one canonical item batch with exact immutable retry identity. */
export const stageItemProgram = Effect.fn("contentRelease.stageItemBatch")(
  function* (
    ctx: MutationCtx,
    releaseId: string,
    batchIndex: number,
    sources: readonly string[]
  ) {
    const database = DatabaseReader.make(databaseSchema, ctx.db);
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
    const { items } = yield* decodeBatch(releaseId, batchIndex, sources);
    const entries = items.map((item) => ({
      item,
      itemJson: encodeItemJson(item),
    }));
    const values = entries.map(({ itemJson }) => itemJson);
    const batchDeletes = items.filter(
      ({ change }) => change.operation === "delete"
    ).length;
    const batchUpserts = items.length - batchDeletes;
    const batchHash = yield* hashBatch("item", releaseId, batchIndex, values);
    const { release, state } = yield* loadStaged(ctx, releaseId);
    const signed = yield* decodeReleaseJson(release.releaseJson);
    if (release.status !== "staging" || release.abortingAt !== undefined) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        `Content release ${releaseId} no longer accepts item batches.`
      );
    }
    if (items.some(({ index }) => index >= signed.manifest.itemCount)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Item batch ${batchIndex} exceeds the signed item count.`
      );
    }
    const existing = yield* database
      .table("contentItems")
      .index("by_releaseId_and_itemBatchIndex", (query) =>
        query.eq("releaseId", releaseId).eq("itemBatchIndex", batchIndex)
      )
      .take(MAX_ITEM_BATCH_COUNT + 1)
      .pipe(Effect.orDie);
    if (existing.length > 0) {
      yield* validateStoredBatch(
        existing.length,
        values.length,
        existing.map(({ itemBatchHash }) => itemBatchHash),
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
      release.stagedItems + items.length > signed.manifest.itemCount ||
      release.stagedDeletes + batchDeletes > signed.manifest.deleteCount ||
      release.stagedUpserts + batchUpserts > signed.manifest.upsertCount
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Item batch ${batchIndex} exceeds signed release counts.`
      );
    }
    const priorSequence = stagedBaseSequence(release.role, state);
    for (const { item, itemJson } of entries) {
      yield* stageContentItem(ctx, {
        batchHash,
        batchIndex,
        item,
        itemJson,
        priorSequence,
        role: release.role,
        sequence: release.sequence,
      });
    }
    yield* writer
      .table("contentReleases")
      .patch(release._id, {
        stagedDeletes: release.stagedDeletes + batchDeletes,
        stagedItems: release.stagedItems + items.length,
        stagedUpserts: release.stagedUpserts + batchUpserts,
        updatedAt: yield* Clock.currentTimeMillis,
      })
      .pipe(Effect.orDie);
    return {
      batchIndex,
      created: values.length,
      releaseId,
      unchanged: 0,
    };
  }
);
