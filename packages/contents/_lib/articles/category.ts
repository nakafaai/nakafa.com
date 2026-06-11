import { ArticleCategorySchema } from "@repo/contents/_types/articles/category";
import type { ArticleCategory } from "@repo/contents/_types/taxonomy";
import { Schema } from "effect";

/**
 * Builds the public route for an article category page.
 *
 * @param category - Article category slug
 * @returns Canonical category path
 */
export function getCategoryPath(category: ArticleCategory) {
  return `/articles/${category}` as const;
}

/** Narrows one article category route segment to the supported category union. */
export function parseArticleCategory(value: string) {
  return Schema.decodeUnknownOption(ArticleCategorySchema)(value);
}
