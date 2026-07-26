import { BookOpen02Icon, EvilIcon } from "@hugeicons/core-free-icons";
import type { ArticleCategory } from "@nakafa/aksara-contracts/projection/article";

/** Selects a known category icon while keeping future categories renderable. */
export function getArticleCategoryIcon(category: ArticleCategory) {
  if (category === "politics") {
    return EvilIcon;
  }
  return BookOpen02Icon;
}
