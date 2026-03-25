import { EvilIcon, News01Icon } from "@hugeicons/core-free-icons";
import type { ArticleCategory } from "@repo/contents/_types/articles/category";

/**
 * Resolves the icon used for an article category.
 *
 * @param category - Article category slug
 * @returns Hugeicons icon for the category
 */
export function getCategoryIcon(category: ArticleCategory) {
  switch (category) {
    case "politics":
      return EvilIcon;
    default:
      return News01Icon;
  }
}

/**
 * Builds the public route for an article category page.
 *
 * @param category - Article category slug
 * @returns Canonical category path
 */
export function getCategoryPath(category: ArticleCategory) {
  return `/articles/${category}` as const;
}
