import { DatabaseReader } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { ARTICLE_VALIDATION_SCAN_LIMIT } from "@repo/backend/confect/contentRelease/article/limits";
import {
  type ArticleCategoryClaim,
  validateCategoryClaim,
  validateCategoryMember,
} from "@repo/backend/confect/contentRelease/article/ownership";
import { READ_MODEL_DOCUMENT_LIMIT } from "@repo/backend/confect/contentRelease/document";
import type { ModelSlot } from "@repo/backend/confect/contentRelease/models/slot";
import { RELEASE_PAGE_LIMIT } from "@repo/backend/confect/contentRelease/spec";
import { convexArticleLayer } from "@repo/backend/content/article/convex";
import { verifyArticle } from "@repo/backend/content/article/verify";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Effect } from "effect";

/** Validates one bounded active-catalog page against the final category model. */
export const validateArticleModel = Effect.fn(
  "contentRelease.validateArticleModel"
)(function* (
  ctx: MutationCtx,
  slot: ModelSlot,
  cursor: string | undefined,
  sequence: number
) {
  const database = DatabaseReader.make(databaseSchema, ctx.db);
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
  const categoryClaims = new Map<string, ArticleCategoryClaim>();
  for (const article of stored.page) {
    yield* verifyArticle(article, sequence).pipe(
      Effect.provide(convexArticleLayer(ctx))
    );
    const categoryIdentity = `${article.appLocale}/${article.category}`;
    const existingClaim = categoryClaims.get(categoryIdentity);
    if (existingClaim) {
      yield* validateCategoryMember(article, existingClaim);
      continue;
    }
    const claim = yield* validateCategoryClaim(ctx, article);
    categoryClaims.set(categoryIdentity, claim);
  }
  return {
    cursor: stored.isDone ? undefined : stored.continueCursor,
    done: stored.isDone,
    processed: stored.page.length,
  };
});
