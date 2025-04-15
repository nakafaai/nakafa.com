import type { ArticleCategory } from "@/types/articles/category";
import { DramaIcon, NewspaperIcon } from "lucide-react";

/**
 * Gets the icon for the category.
 * @param category - The category to get the icon for.
 * @returns The icon for the category.
 */
export function getCategoryIcon(category: ArticleCategory) {
  switch (category) {
    case "politics":
      return DramaIcon;
    default:
      return NewspaperIcon;
  }
}

/**
 * Gets the path to the category.
 * @param category - The category to get the path for.
 * @returns The path to the category.
 */
export function getCategoryPath(category: ArticleCategory) {
  return `/articles/${category}`;
}
