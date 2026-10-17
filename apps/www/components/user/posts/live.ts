import { PaginatedQueryResult } from "@confect/react";
import type { ListPost } from "@/components/user/posts/state";

/**
 * Decides what the posts list shows from its live query and the first page the
 * server read. Until the live list answers its first page, the server's page
 * stands in for it and nothing else shows. A failed read shows above the rows
 * the list holds and keeps them, so a failure never shows the empty sentence.
 * `ready` says whether the live list holds its first page, so that a change
 * made now has a page to show in.
 */
export function postsView<E>(
  live: PaginatedQueryResult.Variants<ListPost, E>,
  first: readonly ListPost[] | null
) {
  if (PaginatedQueryResult.isLoadingFirstPage(live)) {
    return {
      empty: first !== null && first.length === 0,
      failed: false,
      ready: false,
      rows: first ?? [],
    };
  }
  if (PaginatedQueryResult.isFailure(live)) {
    // A first page that failed holds no rows, so the server's page stands in.
    const holdsFirstPage = live.results.length > 0;
    return {
      empty: false,
      failed: true,
      ready: holdsFirstPage,
      rows: holdsFirstPage ? live.results : (first ?? []),
    };
  }
  return {
    empty: live.results.length === 0,
    failed: false,
    ready: true,
    rows: live.results,
  };
}
