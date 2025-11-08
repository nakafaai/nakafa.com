import type { ArticleCategory } from "@repo/contents/_types/articles/category";
import { DramaIcon, NewspaperIcon } from "lucide-react";
import { createElement } from "react";

/**
 * Gets the icon for the category of the article.
 * @param category - The category to get the icon for.
 * @returns The icon for the category.
 */
export function getCategoryIcon(category: ArticleCategory) {
  switch (category) {
    case "politics":
      return createElement(DramaIcon);
    default:
      return createElement(NewspaperIcon);
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
