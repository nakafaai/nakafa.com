import { PaginatedQueryResult } from "@confect/react";

/**
 * Whether the live list holds its first page, so that a change made now has a
 * page to show in. A list still loading its first page has none, and neither
 * has one whose first page failed. A later page that failed keeps its rows.
 */
export function holdsFirstPage<Item, E>(
  live: PaginatedQueryResult.PaginatedQueryResult<Item, E>
) {
  if (PaginatedQueryResult.isLoadingFirstPage(live)) {
    return false;
  }
  return !(PaginatedQueryResult.isFailure(live) && live.results.length === 0);
}
