import { DatabaseWriter } from "@confect/server";
import type { ArticleProjection } from "@nakafa/aksara-contracts/projection/article";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { adjustArticleBucket } from "@repo/backend/confect/contentRelease/article/bucket";
import {
  loadArticle,
  reconcileCategory,
  stageCategory,
} from "@repo/backend/confect/contentRelease/article/ownership";
import { getHashBucket } from "@repo/backend/confect/contentRelease/bucket";
import {
  ensureDocumentSize,
  READ_MODEL_DOCUMENT_LIMIT,
} from "@repo/backend/confect/contentRelease/document";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import type { ModelSlot } from "@repo/backend/confect/contentRelease/models/slot";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Effect } from "effect";

type ContentHead = Pick<
  Doc<"contentHeads">,
  | "artifactLocale"
  | "contentKey"
  | "delivery"
  | "family"
  | "operation"
  | "projectionHash"
  | "releaseId"
  | "rendererDomain"
  | "sequence"
>;
type AppLocale = Doc<"articleCatalog">["appLocale"];

/** Replaces one active article row and reconciles its category ownership. */
export const writeArticle = Effect.fn("contentRelease.writeArticle")(function* (
  ctx: MutationCtx,
  slot: ModelSlot,
  head: ContentHead,
  projection: ArticleProjection
) {
  const writer = DatabaseWriter.make(databaseSchema, ctx.db);
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
      : {
          dateModified: projection.metadata.dateModified,
        }),
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
    yield* writer
      .table("articleCatalog")
      .replace(existing._id, entry)
      .pipe(Effect.orDie);
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
    yield* writer.table("articleCatalog").insert(entry).pipe(Effect.orDie);
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
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
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
    yield* writer.table("articleCatalog").delete(existing._id);
    yield* reconcileCategory(ctx, slot, appLocale, existing.category);
  }
);
