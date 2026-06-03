import { EvilIcon } from "@hugeicons/core-free-icons";
import type { ArticleCategory } from "@repo/contents/_types/articles/category";

/**
 * Resolves the icon used for an article category.
 *
 * @param category - Article category slug
 * @returns Hugeicons icon for the category
 */
export function getCategoryIcon(category: ArticleCategory) {
  const icons = {
    politics: EvilIcon,
  } satisfies Record<ArticleCategory, typeof EvilIcon>;

  return icons[category];
}
