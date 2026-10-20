import type * as Ref from "@confect/core/Ref";
import {
  type PaginatedQueryItem,
  type PaginatedQueryOptions,
  PaginatedQueryResult,
  type UsePaginatedQueryArgs,
  usePaginatedQuery,
} from "@confect/react";

/** The first page that the loader read on the server, and whether it is the last. */
export interface PreloadedPage<Item> {
  readonly isDone: boolean;
  readonly page: readonly Item[];
}

/**
 * Chooses what a paginated list shows. Until the live subscription has its
 * first page, the loader's page stands in as rows that are still loading more.
 * The list offers no `loadMore` until the live subscription can load the next
 * page, so an infinite list's end trigger mounts only with a working `loadMore`,
 * and a trigger that is already in view cannot ask for a page that never loads.
 * A list with no loader page, such as a filtered list, keeps the live result.
 */
export function readFirstPage<Item, E>(
  live: PaginatedQueryResult.PaginatedQueryResult<Item, E>,
  preloaded: PreloadedPage<Item> | undefined
): PaginatedQueryResult.PaginatedQueryResult<Item, E> {
  if (
    preloaded === undefined ||
    !PaginatedQueryResult.isLoadingFirstPage(live)
  ) {
    return live;
  }
  if (preloaded.isDone) {
    return PaginatedQueryResult.exhausted({ results: preloaded.page });
  }
  return PaginatedQueryResult.loadingMore({ results: preloaded.page });
}

/** A paginated Confect query whose first page is the loader's. */
export function usePaginatedPreloaded<
  Query extends Ref.AnyPublicPaginatedQuery,
>(
  ref: Query,
  args: UsePaginatedQueryArgs<Query>,
  options: PaginatedQueryOptions,
  preloaded: PreloadedPage<PaginatedQueryItem<Query>> | undefined
) {
  const live = usePaginatedQuery(ref, args, options);
  return readFirstPage(live, preloaded);
}
