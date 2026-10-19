import type * as Ref from "@confect/core/Ref";
import {
  type PaginatedQueryItem,
  type PaginatedQueryOptions,
  PaginatedQueryResult,
  type UsePaginatedQueryArgs,
  usePaginatedQuery,
} from "@confect/react";

/** The first page that the loader read on the server, and whether it is the last. */
interface PreloadedPage<Item> {
  readonly isDone: boolean;
  readonly page: readonly Item[];
}

/**
 * Chooses what a paginated list shows. Until the live subscription has its
 * first page, the loader's page stands in. Its `loadMore` does nothing until
 * the live subscription can load the next page, so an infinite list waits for
 * the subscription and never asks for a page twice.
 */
export function readFirstPage<Item, E>(
  live: PaginatedQueryResult.PaginatedQueryResult<Item, E>,
  preloaded: PreloadedPage<Item>
): PaginatedQueryResult.PaginatedQueryResult<Item, E> {
  if (!PaginatedQueryResult.isLoadingFirstPage(live)) {
    return live;
  }
  if (preloaded.isDone) {
    return PaginatedQueryResult.exhausted({ results: preloaded.page });
  }
  return PaginatedQueryResult.canLoadMore({
    loadMore: () => undefined,
    results: preloaded.page,
  });
}

/** A paginated Confect query whose first page is the loader's. */
export function usePaginatedPreloaded<
  Query extends Ref.AnyPublicPaginatedQuery,
>(
  ref: Query,
  args: UsePaginatedQueryArgs<Query>,
  options: PaginatedQueryOptions,
  preloaded: PreloadedPage<PaginatedQueryItem<Query>>
) {
  const live = usePaginatedQuery(ref, args, options);
  return readFirstPage(live, preloaded);
}
