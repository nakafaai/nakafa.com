import { DatabaseReader } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { ARTICLE_AGENT_TAXONOMY_LIMIT } from "@repo/backend/confect/contentRelease/article/limits";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { convexArticleLayer } from "@repo/backend/content/article/convex";
import { loadArticleOwner } from "@repo/backend/content/article/owner";
import { verifyCategory } from "@repo/backend/content/article/verify";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { Effect } from "effect";

/** Reads and authenticates one complete bounded article taxonomy. */
export const readAgentArticleTaxonomy = Effect.fn(
  "contentRelease.readAgentArticleTaxonomy"
)(function* (ctx: QueryCtx, appLocale: Parameters<typeof loadArticleOwner>[0]) {
  const database = DatabaseReader.make(databaseSchema, ctx.db);
  const owner = yield* loadArticleOwner(appLocale).pipe(
    Effect.provide(convexArticleLayer(ctx))
  );
  if (!(owner.managed && owner.active && owner.slot)) {
    return {
      categories: [],
      managed: false,
    };
  }
  const rows = yield* database
    .table("articleCategories")
    .index("by_slot_and_appLocale_and_category", (index) =>
      index.eq("slot", owner.slot).eq("appLocale", appLocale)
    )
    .take(ARTICLE_AGENT_TAXONOMY_LIMIT + 1)
    .pipe(Effect.orDie);
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
  return {
    categories,
    managed: true,
  };
});
