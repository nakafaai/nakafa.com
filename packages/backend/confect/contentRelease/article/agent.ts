import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { ARTICLE_AGENT_TAXONOMY_LIMIT } from "@repo/backend/confect/contentRelease/article/limits";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { articleLayer } from "@repo/backend/content/article/confect";
import { loadArticleOwner } from "@repo/backend/content/article/owner";
import { verifyCategory } from "@repo/backend/content/article/verify";
import { Effect } from "effect";

/** Reads and authenticates one complete bounded article taxonomy. */
export const readAgentArticleTaxonomy = Effect.fn(
  "contentRelease.readAgentArticleTaxonomy"
)(function* (appLocale: Parameters<typeof loadArticleOwner>[0]) {
  const database = yield* DatabaseReader;
  const owner = yield* loadArticleOwner(appLocale).pipe(
    Effect.provide(articleLayer)
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
      Effect.provide(articleLayer),
      Effect.map(({ category }) => category)
    )
  );
  return {
    categories,
    managed: true,
  };
});
