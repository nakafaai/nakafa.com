import { useRequired } from "@repo/design-system/hooks/required";
import { createContext } from "react";
import type { ArticleNavigationItem } from "@/lib/content/article/navigation";

/**
 * The article navigation of the page. The deferred command search provides it
 * above its lazy dialog, which lists the articles before a search runs.
 */
export const ArticleNavigationContext = createContext<
  readonly ArticleNavigationItem[] | null
>(null);

/** Reads the article navigation that the command search lists before a search. */
export function useArticleNavigation() {
  return useRequired(ArticleNavigationContext, "useArticleNavigation");
}
