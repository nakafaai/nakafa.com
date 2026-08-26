import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { ARTICLE_AGENT_TAXONOMY_LIMIT } from "@repo/backend/convex/contentRelease/article/limits";
import { loadArticleOwner } from "@repo/backend/convex/contentRelease/article/owner";
import { verifyCategory } from "@repo/backend/convex/contentRelease/article/verify";
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
)(function* (ctx: QueryCtx, appLocale: Parameters<typeof loadArticleOwner>[1]) {
  const owner = yield* loadArticleOwner(ctx, appLocale);
  if (!(owner.managed && owner.active)) {
    return { categories: [], managed: false };
  }

  const rows = yield* Effect.promise(() =>
    ctx.db
      .query("articleCategories")
      .withIndex("by_appLocale_and_category", (index) =>
        index.eq("appLocale", appLocale)
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
    verifyCategory(ctx, row, owner.active.sequence).pipe(
      Effect.map(({ category }) => category)
    )
  );
  return { categories, managed: true };
});
