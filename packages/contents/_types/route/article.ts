import { getCategoryPath } from "@repo/contents/_lib/articles/category";
import { readArticleCategoryTitle } from "@repo/contents/_types/articles/category";
import {
  decodeArticleRoute,
  decodePublicPath,
  normalizePublicPath,
  uniqueRoutes,
} from "@repo/contents/_types/route/path";
import type { PublicArticleRoute } from "@repo/contents/_types/route/schema";
import { ARTICLE_CATEGORIES } from "@repo/contents/_types/taxonomy";
import { locales } from "@repo/utilities/locales";
import { Effect } from "effect";

/** Projects every finite article category into one durable localized route. */
export const listPublicArticleRoutes = Effect.fn("contents.route.listArticles")(
  function* () {
    const routes: PublicArticleRoute[] = [];

    for (const locale of locales) {
      for (const category of ARTICLE_CATEGORIES) {
        const publicPath = yield* decodePublicPath(
          normalizePublicPath(getCategoryPath(category))
        );

        routes.push(
          yield* decodeArticleRoute({
            category,
            kind: "article-category",
            locale,
            publicPath,
            sitemap: true,
            title: readArticleCategoryTitle(category, locale),
          })
        );
      }
    }

    return yield* uniqueRoutes(routes);
  }
);
