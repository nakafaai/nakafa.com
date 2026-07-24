import { EvilIcon } from "@hugeicons/core-free-icons";
import type { ArticleCategory } from "@nakafa/aksara-contracts/projection/article";

const ARTICLE_ICONS = {
  politics: EvilIcon,
} satisfies Record<ArticleCategory, typeof EvilIcon>;

/** Returns the established icon for one published article category. */
export function getArticleCategoryIcon(category: ArticleCategory) {
  return ARTICLE_ICONS[category];
}
