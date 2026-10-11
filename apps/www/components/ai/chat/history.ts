import { PaginatedQueryResult } from "@confect/react";

/** How many chats a list loads at first, and with each press of Show more. */
export const CHAT_LIST_PAGE_SIZE = 50;

/**
 * What a chat list shows for the paginated query it reads. While the first page
 * of a new search loads, it shows the rows it settled on before, so the list
 * never goes blank or fills with placeholder rows. `loadMore` is there only
 * while another page can be loaded, and `loadingMore` holds the place of the
 * button while that page arrives.
 */
export function readChatList<Item, E>(
  settled: readonly Item[],
  pagination: PaginatedQueryResult.Variants<Item, E>
) {
  return {
    loadMore: PaginatedQueryResult.isCanLoadMore(pagination)
      ? () => pagination.loadMore(CHAT_LIST_PAGE_SIZE)
      : undefined,
    loadingMore: PaginatedQueryResult.isLoadingMore(pagination),
    results: PaginatedQueryResult.isLoadingFirstPage(pagination)
      ? settled
      : pagination.results,
  };
}
