import type * as Ref from "@confect/core/Ref";
import {
  type PaginatedQueryItem,
  type PaginatedQueryOptions,
  PaginatedQueryResult,
  type UsePaginatedQueryArgs,
  usePaginatedQuery,
} from "@confect/react";
import { Option } from "effect";

/**
 * The first page that the loader read on the server, and whether it is the last.
 * This is the one owner of the shape: a loader returns it as plain data, because
 * an Effect Option does not survive the trip to the browser, and the page takes
 * it as an Option.
 */
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
  preloaded: Option.Option<PreloadedPage<Item>>
): PaginatedQueryResult.PaginatedQueryResult<Item, E> {
  if (
    Option.isNone(preloaded) ||
    !PaginatedQueryResult.isLoadingFirstPage(live)
  ) {
    return live;
  }
  if (preloaded.value.isDone) {
    return PaginatedQueryResult.exhausted({ results: preloaded.value.page });
  }
  return PaginatedQueryResult.loadingMore({ results: preloaded.value.page });
}

/** A paginated Confect query whose first page is the loader's. */
export function usePaginatedPreloaded<
  Query extends Ref.AnyPublicPaginatedQuery,
>(
  ref: Query,
  args: UsePaginatedQueryArgs<Query>,
  options: PaginatedQueryOptions,
  preloaded: Option.Option<PreloadedPage<PaginatedQueryItem<Query>>>
) {
  const live = usePaginatedQuery(ref, args, options);
  return readFirstPage(live, preloaded);
}
