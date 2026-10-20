import "@tanstack/react-start/server-only";

import {
  ArticleCategorySchema,
  ArticleCategoryTitleSchema,
} from "@nakafa/aksara-contracts/projection/article";
import { Array as Arr, Effect, Schema } from "effect";
import type { Locale } from "use-intl";
import { readPublishedArticleCategories } from "@/lib/content/article/category";
import { hasPreviewConfig } from "@/lib/content/preview/config";

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
    const { categories } = yield* readPublishedArticleCategories(locale);
    return Arr.map(categories, ({ category, route, title }) => ({
      category,
      href: `/articles/${route}`,
      title,
    }));
  }
);

/**
 * Caches complete article navigation under exact article release tags. The `use
 * cache` boundary stays so that the shells still prerender and the article tag
 * still expires them; behind it the category list comes from the content store.
 */
async function getArticleNavigation(locale: Locale) {
  const navigation = await Effect.runPromise(
    readArticleNavigation(locale).pipe(Effect.withTracerTiming(false))
  );
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
