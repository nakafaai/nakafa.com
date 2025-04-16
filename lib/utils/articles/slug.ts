import type { ArticleCategory } from "@/types/articles/category";

/**
 * Gets the path to an article based on its category and slug.
 * @param category - The category of the article.
 * @param slug - The slug of the article.
 * @returns The path to the article.
 */
export function getSlugPath(category: ArticleCategory, slug: string) {
  return `/articles/${category}/${slug}` as const;
}
