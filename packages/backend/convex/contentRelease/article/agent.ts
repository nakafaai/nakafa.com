import { convexArticleLayer } from "@repo/backend/content/article/convex";
import { loadArticleOwner } from "@repo/backend/content/article/owner";
import { verifyCategory } from "@repo/backend/content/article/verify";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { ARTICLE_AGENT_TAXONOMY_LIMIT } from "@repo/backend/convex/contentRelease/article/limits";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { v } from "convex/values";
import { Effect } from "effect";

/** Bounded article taxonomy returned to the protected agent transport. */
export const agentArticleTaxonomyValidator = v.object({
  categories: v.array(v.string()),
  managed: v.boolean(),
});

/** Reads and authenticates one complete bounded article taxonomy. */
export const readAgentArticleTaxonomy = Effect.fn(
  "contentRelease.readAgentArticleTaxonomy"
)(function* (ctx: QueryCtx, appLocale: Parameters<typeof loadArticleOwner>[0]) {
  const owner = yield* loadArticleOwner(appLocale).pipe(
    Effect.provide(convexArticleLayer(ctx))
  );
  if (!(owner.managed && owner.active && owner.slot)) {
    return { categories: [], managed: false };
  }

  const rows = yield* Effect.promise(() =>
    ctx.db
      .query("articleCategories")
      .withIndex("by_slot_and_appLocale_and_category", (index) =>
        index.eq("slot", owner.slot).eq("appLocale", appLocale)
      )
      .take(ARTICLE_AGENT_TAXONOMY_LIMIT + 1)
  );
  if (rows.length > ARTICLE_AGENT_TAXONOMY_LIMIT) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Article taxonomy for ${appLocale} exceeds ${ARTICLE_AGENT_TAXONOMY_LIMIT} verified categories.`
    );
  }

  const categories = yield* Effect.forEach(rows, (row) =>
    verifyCategory(row, owner.active.sequence).pipe(
      Effect.provide(convexArticleLayer(ctx)),
      Effect.map(({ category }) => category)
    )
  );
  return { categories, managed: true };
});
