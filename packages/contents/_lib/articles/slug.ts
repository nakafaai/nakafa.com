import type { ArticleCategory } from "@repo/contents/_types/taxonomy";

/**
 * Builds the public URL path for an article detail page.
 *
 * @param category - Article category slug
 * @param slug - Article slug within the category
 * @returns Canonical article path
 */
export function getSlugPath(category: ArticleCategory, slug: string) {
  return `/articles/${category}/${slug}` as const;
}
