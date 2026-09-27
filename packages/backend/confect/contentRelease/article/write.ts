import type { ArticleProjection } from "@nakafa/aksara-contracts/projection/article";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
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
import { Effect } from "effect";

type ContentHead = Pick<
  Docs["contentHeads"],
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
type AppLocale = Docs["articleCatalog"]["appLocale"];

/** Replaces one active article row and reconciles its category ownership. */
export const writeArticle = Effect.fn("contentRelease.writeArticle")(function* (
  slot: ModelSlot,
  head: ContentHead,
  projection: ArticleProjection
) {
  const writer = yield* DatabaseWriter;
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
    slot,
    head.contentKey,
    projection.appLocale
  );
  if (existing) {
    if (existing.bucket !== entry.bucket) {
      yield* adjustArticleBucket(
        slot,
        existing.appLocale,
        existing.bucket,
        "article",
        -1
      );
      yield* adjustArticleBucket(
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
      yield* reconcileCategory(slot, projection.appLocale, existing.category);
    }
  } else {
    yield* adjustArticleBucket(
      slot,
      entry.appLocale,
      entry.bucket,
      "article",
      1
    );
    yield* writer.table("articleCatalog").insert(entry).pipe(Effect.orDie);
  }
  yield* stageCategory(entry, projection.categoryRouteSlug);
});

/** Deletes one active article row and reconciles its former category. */
export const deleteArticle = Effect.fn("contentRelease.deleteArticle")(
  function* (slot: ModelSlot, contentKey: string, appLocale: AppLocale) {
    const writer = yield* DatabaseWriter;
    const existing = yield* loadArticle(slot, contentKey, appLocale);
    if (!existing) {
      return;
    }
    yield* adjustArticleBucket(
      slot,
      existing.appLocale,
      existing.bucket,
      "article",
      -1
    );
    yield* writer.table("articleCatalog").delete(existing._id);
    yield* reconcileCategory(slot, appLocale, existing.category);
  }
);
