import { convexArticleLayer } from "@repo/backend/content/article/convex";
import { verifyArticle } from "@repo/backend/content/article/verify";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { ARTICLE_VALIDATION_SCAN_LIMIT } from "@repo/backend/convex/contentRelease/article/limits";
import {
  type ArticleCategoryClaim,
  type ArticlePredecessorRoutes,
  loadPredecessorRoutes,
  validateCategoryClaim,
  validateCategoryMember,
} from "@repo/backend/convex/contentRelease/article/ownership";
import { READ_MODEL_DOCUMENT_LIMIT } from "@repo/backend/convex/contentRelease/document";
import type { ModelSlot } from "@repo/backend/convex/contentRelease/models/slot";
import { RELEASE_PAGE_LIMIT } from "@repo/backend/convex/contentRelease/spec";
import { Effect } from "effect";

type AppLocale = Doc<"articleCatalog">["appLocale"];

/** Validates one bounded active-catalog page against the final category model. */
export const validateArticleModel = Effect.fn(
  "contentRelease.validateArticleModel"
)(function* (
  ctx: MutationCtx,
  slot: ModelSlot,
  cursor: string | undefined,
  sequence: number
) {
  const stored = yield* Effect.promise(() =>
    ctx.db
      .query("articleCatalog")
      .withIndex(
        "by_slot_appLocale_category_datePublished_contentKey",
        (index) => index.eq("slot", slot)
      )
      .paginate({
        cursor: cursor ?? null,
        maximumBytesRead:
          ARTICLE_VALIDATION_SCAN_LIMIT * READ_MODEL_DOCUMENT_LIMIT,
        maximumRowsRead: ARTICLE_VALIDATION_SCAN_LIMIT,
        numItems: RELEASE_PAGE_LIMIT,
      })
  );
  const categoryClaims = new Map<string, ArticleCategoryClaim>();
  const predecessorRoutes = new Map<AppLocale, ArticlePredecessorRoutes>();
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
    let predecessors = predecessorRoutes.get(article.appLocale);
    if (!predecessors) {
      predecessors = yield* loadPredecessorRoutes(ctx, slot, article.appLocale);
      predecessorRoutes.set(article.appLocale, predecessors);
    }
    const claim = yield* validateCategoryClaim(ctx, article, predecessors);
    categoryClaims.set(categoryIdentity, claim);
  }
  return {
    cursor: stored.isDone ? undefined : stored.continueCursor,
    done: stored.isDone,
    processed: stored.page.length,
  };
});
