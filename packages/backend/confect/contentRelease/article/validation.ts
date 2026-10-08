import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { ARTICLE_VALIDATION_SCAN_LIMIT } from "@repo/backend/confect/contentRelease/article/limits";
import {
  type ArticleCategoryClaim,
  validateCategoryClaim,
  validateCategoryMember,
} from "@repo/backend/confect/contentRelease/article/ownership";
import { READ_MODEL_DOCUMENT_LIMIT } from "@repo/backend/confect/contentRelease/document";
import type { ModelSlot } from "@repo/backend/confect/contentRelease/models/slot";
import { RELEASE_PAGE_LIMIT } from "@repo/backend/confect/contentRelease/spec";
import { articleLayer } from "@repo/backend/content/article/confect";
import { verifyArticle } from "@repo/backend/content/article/verify";
import { Effect, MutableHashMap, Option } from "effect";

/** Validates one bounded active-catalog page against the final category model. */
export const validateArticleModel = Effect.fn(
  "contentRelease.validateArticleModel"
)(function* (slot: ModelSlot, cursor: string | undefined, sequence: number) {
  const database = yield* DatabaseReader;
  const stored = yield* database
    .table("articleCatalog")
    .index("by_slot_appLocale_category_datePublished_contentKey", (index) =>
      index.eq("slot", slot)
    )
    .paginate({
      cursor: cursor ?? null,
      maximumBytesRead:
        ARTICLE_VALIDATION_SCAN_LIMIT * READ_MODEL_DOCUMENT_LIMIT,
      maximumRowsRead: ARTICLE_VALIDATION_SCAN_LIMIT,
      numItems: RELEASE_PAGE_LIMIT,
    })
    .pipe(Effect.orDie);
  const categoryClaims = MutableHashMap.empty<string, ArticleCategoryClaim>();
  for (const article of stored.page) {
    yield* verifyArticle(article, sequence).pipe(Effect.provide(articleLayer));
    const categoryIdentity = `${article.appLocale}/${article.category}`;
    const existingClaim = MutableHashMap.get(categoryClaims, categoryIdentity);
    if (Option.isSome(existingClaim)) {
      yield* validateCategoryMember(article, existingClaim.value);
      continue;
    }
    const claim = yield* validateCategoryClaim(article);
    MutableHashMap.set(categoryClaims, categoryIdentity, claim);
  }
  return {
    cursor: stored.isDone ? undefined : stored.continueCursor,
    done: stored.isDone,
    processed: stored.page.length,
  };
});
