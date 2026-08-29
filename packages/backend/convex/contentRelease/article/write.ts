import type { ArticleProjection } from "@nakafa/aksara-contracts/projection/article";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { adjustArticleBucket } from "@repo/backend/convex/contentRelease/article/bucket";
import {
  loadArticle,
  reconcileCategory,
  stageCategory,
} from "@repo/backend/convex/contentRelease/article/ownership";
import { getHashBucket } from "@repo/backend/convex/contentRelease/bucket";
import {
  ensureDocumentSize,
  READ_MODEL_DOCUMENT_LIMIT,
} from "@repo/backend/convex/contentRelease/document";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import type { ModelSlot } from "@repo/backend/convex/contentRelease/models/slot";
import type { WithoutSystemFields } from "convex/server";
import { Effect } from "effect";

type ContentHead = WithoutSystemFields<Doc<"contentHeads">>;
type AppLocale = Doc<"articleCatalog">["appLocale"];

/** Replaces one active article row and reconciles its category ownership. */
export const writeArticle = Effect.fn("contentRelease.writeArticle")(function* (
  ctx: MutationCtx,
  slot: ModelSlot,
  head: ContentHead,
  projection: ArticleProjection
) {
  if (
    head.operation !== "upsert" ||
    head.delivery !== "public" ||
    head.family !== "article" ||
    !head.projectionHash ||
    !head.rendererDomain ||
    projection.contentKey !== head.contentKey ||
    projection.artifactLocale !== head.artifactLocale
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Article entry ${head.contentKey}/${head.artifactLocale} lost its public identity.`
    );
  }
  const bucket = getHashBucket(head.projectionHash);
  if (!bucket) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Article entry ${head.contentKey}/${head.artifactLocale} has an invalid projection hash.`
    );
  }
  const entry = {
    appLocale: projection.appLocale,
    assetId: projection.graph.assetId,
    bucket,
    category: projection.category,
    categoryTitle: projection.categoryTitle,
    contentKey: head.contentKey,
    ...(projection.metadata.dateModified === undefined
      ? {}
      : { dateModified: projection.metadata.dateModified }),
    datePublished: projection.metadata.datePublished,
    projectionHash: head.projectionHash,
    publicPath: projection.publicPath,
    releaseId: head.releaseId,
    rendererDomain: head.rendererDomain,
    sequence: head.sequence,
    slot,
  };
  yield* ensureDocumentSize(
    "Active article catalog entry",
    entry,
    READ_MODEL_DOCUMENT_LIMIT
  );
  const existing = yield* loadArticle(
    ctx,
    slot,
    head.contentKey,
    projection.appLocale
  );
  if (existing) {
    if (existing.bucket !== entry.bucket) {
      yield* adjustArticleBucket(
        ctx,
        slot,
        existing.appLocale,
        existing.bucket,
        "article",
        -1
      );
      yield* adjustArticleBucket(
        ctx,
        slot,
        entry.appLocale,
        entry.bucket,
        "article",
        1
      );
    }
    yield* Effect.promise(() =>
      ctx.db.replace("articleCatalog", existing._id, entry)
    );
    if (existing.category !== entry.category) {
      yield* reconcileCategory(
        ctx,
        slot,
        projection.appLocale,
        existing.category
      );
    }
  } else {
    yield* adjustArticleBucket(
      ctx,
      slot,
      entry.appLocale,
      entry.bucket,
      "article",
      1
    );
    yield* Effect.promise(() => ctx.db.insert("articleCatalog", entry));
  }
  yield* stageCategory(ctx, entry, projection.categoryRouteSlug);
});

/** Deletes one active article row and reconciles its former category. */
export const deleteArticle = Effect.fn("contentRelease.deleteArticle")(
  function* (
    ctx: MutationCtx,
    slot: ModelSlot,
    contentKey: string,
    appLocale: AppLocale
  ) {
    const existing = yield* loadArticle(ctx, slot, contentKey, appLocale);
    if (!existing) {
      return;
    }
    yield* adjustArticleBucket(
      ctx,
      slot,
      existing.appLocale,
      existing.bucket,
      "article",
      -1
    );
    yield* Effect.promise(() => ctx.db.delete("articleCatalog", existing._id));
    yield* reconcileCategory(ctx, slot, appLocale, existing.category);
  }
);
