import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { verifyArticle } from "@repo/backend/convex/contentRelease/article/verify";
import { AUDITED_ARTICLE_COUNT } from "@repo/backend/convex/contentRelease/cutover/inventory";
import { requireCutoverPhase } from "@repo/backend/convex/contentRelease/cutover/state";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { Effect } from "effect";

const articleAssetReceiptValidator = v.object({
  complete: v.literal(true),
  total: v.number(),
  unchanged: v.number(),
  updated: v.number(),
});

/** Authenticates and persists every active article's signed graph asset ID. */
export const stageArticleAssetIds = Effect.fn(
  "contentRelease.cutover.stageArticleAssetIds"
)(function* (ctx: MutationCtx, expectedCount: number) {
  const state = yield* requireCutoverPhase(ctx, ["quiescent"]);
  const articles = yield* Effect.promise(() =>
    ctx.db.query("articleCatalog").take(expectedCount + 1)
  );
  if (articles.length !== expectedCount) {
    return yield* articleAssetFailure(
      `Expected ${expectedCount} active articles but found ${articles.length}.`
    );
  }

  const assetIdentities = new Set<string>();
  const contentIdentities = new Set<string>();
  const routeIdentities = new Set<string>();
  let unchanged = 0;
  let updated = 0;
  for (const article of articles) {
    const verified = yield* verifyArticle(
      ctx,
      article,
      state.auditedActiveSequence
    );
    const assetId = verified.projection.graph.assetId;
    const assetIdentity = `${article.locale}\0${assetId}`;
    const contentIdentity = `${article.locale}\0${article.contentKey}`;
    const routeIdentity = `${article.locale}\0${article.publicPath}`;
    if (assetIdentities.has(assetIdentity)) {
      return yield* articleAssetFailure(
        `Article asset ${article.locale}/${assetId} is not unique.`
      );
    }
    if (contentIdentities.has(contentIdentity)) {
      return yield* articleAssetFailure(
        `Article content key ${article.locale}/${article.contentKey} is not unique.`
      );
    }
    if (routeIdentities.has(routeIdentity)) {
      return yield* articleAssetFailure(
        `Article route ${article.locale}/${article.publicPath} is not unique.`
      );
    }
    assetIdentities.add(assetIdentity);
    contentIdentities.add(contentIdentity);
    routeIdentities.add(routeIdentity);

    if (article.assetId !== undefined) {
      if (article.assetId !== assetId) {
        return yield* articleAssetFailure(
          `Article ${article.contentKey}/${article.locale} has a different stored asset ID.`
        );
      }
      unchanged += 1;
      continue;
    }
    yield* Effect.promise(() =>
      ctx.db.patch("articleCatalog", article._id, { assetId })
    );
    updated += 1;
  }

  return {
    complete: true as const,
    total: articles.length,
    unchanged,
    updated,
  };
});

/** Bounded production-only migration for the exact audited article inventory. */
export const stage = internalMutation({
  args: {},
  returns: articleAssetReceiptValidator,
  handler: (ctx) =>
    runConvexProgram(stageArticleAssetIds(ctx, AUDITED_ARTICLE_COUNT)),
});

function articleAssetFailure(message: string) {
  return releaseFail(
    "CONTENT_RELEASE_INTEGRITY",
    `Article reader cutover: ${message}`
  );
}
