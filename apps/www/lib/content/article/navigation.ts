import "server-only";

import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import {
  ArticleCategorySchema,
  ArticleCategoryTitleSchema,
} from "@nakafa/aksara-contracts/projection/article";
import { Array as Arr, Effect, MutableList, Schema } from "effect";
import type { Locale } from "next-intl";
import {
  type ArticlePageCursor,
  type PublishedCategoryPage,
  readPublishedCategories,
} from "@/lib/content/article/catalog";
import { applyContentCache } from "@/lib/content/cache";
import { hasPreviewConfig } from "@/lib/content/preview/config";
import { PublishedProjectionError } from "@/lib/content/published/errors";

const ArticleNavigationItemSchema = Schema.Struct({
  category: ArticleCategorySchema,
  href: Schema.String,
  title: ArticleCategoryTitleSchema,
});

/** One signed article category projected into Nakafa's navigation contract. */
export type ArticleNavigationItem = typeof ArticleNavigationItemSchema.Type;

/** Reads every signed article category under one immutable release identity. */
export const readArticleNavigation = Effect.fn("www.articles.readNavigation")(
  function* (locale: Locale) {
    const navigation = MutableList.make<ArticleNavigationItem>();
    let cursor: ArticlePageCursor = {
      cursor: null,
      expectedManifestHash: null,
      expectedReleaseId: null,
    };

    while (true) {
      const page: PublishedCategoryPage = yield* readPublishedCategories({
        ...cursor,
        locale,
      });
      if (page.stale) {
        return yield* new PublishedProjectionError({
          appLocale: AppLocaleSchema.make(locale),
          publicPath: "articles",
        });
      }

      MutableList.appendAll(
        navigation,
        Arr.map(page.categories, ({ category, route, title }) => ({
          category,
          href: `/articles/${route}`,
          title,
        }))
      );
      if (page.done) {
        return MutableList.toArray(navigation);
      }

      cursor = {
        cursor: page.nextCursor,
        expectedManifestHash: page.activeManifestHash,
        expectedReleaseId: page.activeReleaseId,
      };
    }
  }
);

/** Caches complete article navigation under exact article release tags. */
export async function getArticleNavigation(locale: Locale) {
  "use cache";

  const navigation = await Effect.runPromise(
    readArticleNavigation(locale).pipe(Effect.withTracerTiming(false))
  );
  applyContentCache("article");
  return navigation;
}

/**
 * Keeps the application shell independent from signed article publication
 * while Aksara serves one exact local preview document.
 */
export function getShellArticleNavigation(locale: Locale) {
  if (hasPreviewConfig()) {
    return Promise.resolve<readonly ArticleNavigationItem[]>([]);
  }

  return getArticleNavigation(locale);
}
