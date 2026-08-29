import {
  canonicalizeMaterialProjection,
  type MaterialLessonProjection,
} from "@nakafa/aksara-contracts/projection/material";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { getHashBucket } from "@repo/backend/convex/contentRelease/bucket";
import type { resolvePublicProjection } from "@repo/backend/convex/contentRelease/catalog";
import { hashText } from "@repo/backend/convex/contentRelease/digest";
import {
  ensureDocumentSize,
  READ_MODEL_DOCUMENT_LIMIT,
} from "@repo/backend/convex/contentRelease/document";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { adjustMaterialBucket } from "@repo/backend/convex/contentRelease/material/bucket";
import { deriveMaterialTopicReference } from "@repo/backend/convex/contentRelease/material/topic";
import type { ModelSlot } from "@repo/backend/convex/contentRelease/models/slot";
import { Effect } from "effect";

type PublicProjection = NonNullable<
  Effect.Success<ReturnType<typeof resolvePublicProjection>>
>;
type AppLocale = Doc<"materialCatalog">["appLocale"];
/** Loads the sole active material row for one localized content identity. */
const loadMaterial = Effect.fn("contentRelease.loadMaterial")(function* (
  ctx: MutationCtx,
  slot: ModelSlot,
  contentKey: string,
  appLocale: AppLocale
) {
  return yield* Effect.promise(() =>
    ctx.db
      .query("materialCatalog")
      .withIndex("by_slot_and_contentKey_and_appLocale", (index) =>
        index
          .eq("slot", slot)
          .eq("contentKey", contentKey)
          .eq("appLocale", appLocale)
      )
      .unique()
  );
});
/** Replaces one active material lesson with its indexed curriculum facts. */
export const writeMaterial = Effect.fn("contentRelease.writeMaterial")(
  function* (
    ctx: MutationCtx,
    slot: ModelSlot,
    head: PublicProjection,
    projection: MaterialLessonProjection
  ) {
    if (
      head.family !== "material" ||
      !head.projectionJson ||
      !head.rendererDomain ||
      !head.sourcePath ||
      projection.contentKey !== head.contentKey ||
      projection.appLocale !== head.appLocale ||
      projection.artifactLocale !== head.artifactLocale ||
      projection.publicPath !== head.publicPath
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Material entry ${head.contentKey}/${head.appLocale} lost its public identity.`
      );
    }
    const projectionJson = canonicalizeMaterialProjection(projection);
    const projectionHash = yield* hashText(
      "the active material projection",
      projectionJson
    );
    if (
      head.projectionHash !== projectionHash ||
      head.projectionJson !== projectionJson
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Material entry ${head.contentKey}/${head.appLocale} changed its projection.`
      );
    }
    const bucket = getHashBucket(projectionHash);
    if (!bucket) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Material entry ${head.contentKey}/${head.appLocale} has an invalid projection hash.`
      );
    }
    const topic = yield* deriveMaterialTopicReference(projection);
    const row = {
      appLocale: head.appLocale,
      assetId: projection.graph.assetId,
      bucket,
      contentKey: head.contentKey,
      ...(projection.metadata.dateModified === undefined
        ? {}
        : { dateModified: projection.metadata.dateModified }),
      datePublished: projection.metadata.datePublished,
      materialKey: projection.materialKey,
      order: projection.order,
      parentPath: projection.parentPath,
      projectionHash,
      projectionJson,
      publicPath: projection.publicPath,
      releaseId: head.releaseId,
      rendererDomain: head.rendererDomain,
      sequence: head.sequence,
      sourcePath: head.sourcePath,
      topicAssetId: topic.graph.assetId,
      slot,
    };
    yield* ensureDocumentSize(
      "Active material catalog entry",
      row,
      READ_MODEL_DOCUMENT_LIMIT
    );
    const existing = yield* loadMaterial(
      ctx,
      slot,
      head.contentKey,
      head.appLocale
    );
    if (existing) {
      if (existing.bucket !== row.bucket) {
        yield* adjustMaterialBucket(
          ctx,
          slot,
          existing.appLocale,
          existing.bucket,
          -1
        );
        yield* adjustMaterialBucket(ctx, slot, row.appLocale, row.bucket, 1);
      }
      yield* Effect.promise(() =>
        ctx.db.replace("materialCatalog", existing._id, row)
      );
      return;
    }
    yield* adjustMaterialBucket(ctx, slot, row.appLocale, row.bucket, 1);
    yield* Effect.promise(() => ctx.db.insert("materialCatalog", row));
  }
);
/** Deletes one active localized material row when its head disappears. */
export const deleteMaterial = Effect.fn("contentRelease.deleteMaterial")(
  function* (
    ctx: MutationCtx,
    slot: ModelSlot,
    contentKey: string,
    appLocale: AppLocale
  ) {
    const existing = yield* loadMaterial(ctx, slot, contentKey, appLocale);
    if (!existing) {
      return;
    }
    yield* adjustMaterialBucket(
      ctx,
      slot,
      existing.appLocale,
      existing.bucket,
      -1
    );
    yield* Effect.promise(() => ctx.db.delete("materialCatalog", existing._id));
  }
);
