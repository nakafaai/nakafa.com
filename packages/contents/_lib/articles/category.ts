import { EvilIcon, News01Icon } from "@hugeicons/core-free-icons";
import type { ArticleCategory } from "@repo/contents/_types/articles/category";

/**
 * Gets the icon for the category of the article.
 * @param category - The category to get the icon for.
 * @returns The icon for the category.
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
 * Gets the path to the category of the article.
 * @param category - The category to get the path for.
 * @returns The path to the category.
 */
export function getCategoryPath(category: ArticleCategory) {
  return `/articles/${category}` as const;
}
