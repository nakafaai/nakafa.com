import {
  canonicalizeMaterialProjection,
  type MaterialProjectionWire,
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
import { Effect } from "effect";

type PublicProjection = NonNullable<
  Effect.Effect.Success<ReturnType<typeof resolvePublicProjection>>
>;
type ContentLocale = Doc<"materialCatalog">["locale"];

/** Loads the sole active material row for one localized content identity. */
const loadMaterial = Effect.fn("contentRelease.loadMaterial")(function* (
  ctx: MutationCtx,
  contentKey: string,
  locale: ContentLocale
) {
  return yield* Effect.promise(() =>
    ctx.db
      .query("materialCatalog")
      .withIndex("by_contentKey_and_locale", (index) =>
        index.eq("contentKey", contentKey).eq("locale", locale)
      )
      .unique()
  );
});

/** Replaces one active material lesson with its indexed curriculum facts. */
export const writeMaterial = Effect.fn("contentRelease.writeMaterial")(
  function* (
    ctx: MutationCtx,
    head: PublicProjection,
    projection: MaterialProjectionWire
  ) {
    if (
      head.family !== "material" ||
      !head.projectionHash ||
      !head.projectionJson ||
      !head.rendererDomain ||
      !head.sourcePath ||
      projection.contentKey !== head.contentKey ||
      projection.locale !== head.locale ||
      projection.publicPath !== head.publicPath
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Material entry ${head.contentKey}/${head.locale} lost its public identity.`
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
        `Material entry ${head.contentKey}/${head.locale} changed its projection.`
      );
    }
    const bucket = getHashBucket(projectionHash);
    if (!bucket) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Material entry ${head.contentKey}/${head.locale} has an invalid projection hash.`
      );
    }
    const row = {
      assetId: projection.graph.assetId,
      bucket,
      contentKey: head.contentKey,
      date: projection.metadata.date,
      locale: head.locale,
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
    };
    yield* ensureDocumentSize(
      "Active material catalog entry",
      row,
      READ_MODEL_DOCUMENT_LIMIT
    );
    const existing = yield* loadMaterial(ctx, head.contentKey, head.locale);
    if (existing) {
      if (existing.bucket !== row.bucket) {
        if (existing.bucket !== undefined) {
          yield* adjustMaterialBucket(
            ctx,
            existing.locale,
            existing.bucket,
            -1
          );
        }
        yield* adjustMaterialBucket(ctx, row.locale, row.bucket, 1);
      }
      yield* Effect.promise(() =>
        ctx.db.replace("materialCatalog", existing._id, row)
      );
      return;
    }
    yield* adjustMaterialBucket(ctx, row.locale, row.bucket, 1);
    yield* Effect.promise(() => ctx.db.insert("materialCatalog", row));
  }
);

/** Deletes one active localized material row when its head disappears. */
export const deleteMaterial = Effect.fn("contentRelease.deleteMaterial")(
  function* (ctx: MutationCtx, contentKey: string, locale: ContentLocale) {
    const existing = yield* loadMaterial(ctx, contentKey, locale);
    if (!existing) {
      return;
    }
    if (existing.bucket !== undefined) {
      yield* adjustMaterialBucket(ctx, existing.locale, existing.bucket, -1);
    }
    yield* Effect.promise(() => ctx.db.delete("materialCatalog", existing._id));
  }
);
