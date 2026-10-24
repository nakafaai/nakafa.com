import { linkOptions } from "@tanstack/react-router";
import type { ArticleNextSearch } from "@/lib/content/article/query";
import type { LinkTarget } from "@/lib/routing/link";
import { LOCALE_ROUTE } from "@/lib/routing/tree";

/**
 * The typed target of the next page of an article catalog: the category page, or
 * the article index when the catalog has no category. The search carries the
 * continuation cursor and the release that issued it.
 */
export function articleNextTarget({
  category,
  search,
}: {
  readonly category?: string | undefined;
  readonly search: ArticleNextSearch;
}): LinkTarget {
  return category === undefined
    ? linkOptions({ from: LOCALE_ROUTE, search, to: "/$locale/articles" })
    : linkOptions({
        from: LOCALE_ROUTE,
        params: { category },
        search,
        to: "/$locale/articles/$category",
      });
}
