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

/** The shell lists no article while the local preview owns the navigation. */
const noArticleNavigation: readonly ArticleNavigationItem[] = [];

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
 * The article navigation of the application shell. While Aksara serves one exact
 * local preview document, the shell lists no article and reads no signed catalog.
 */
export const getShellArticleNavigation = Effect.fn(
  "www.articles.shellNavigation"
)(function* (locale: Locale) {
  if (hasPreviewConfig()) {
    return noArticleNavigation;
  }
  return yield* readArticleNavigation(locale);
});
