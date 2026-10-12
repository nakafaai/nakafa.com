import { PaginatedQueryResult } from "@confect/react";

/** How many chats a list loads at first, and each time its end comes into view. */
export const CHAT_LIST_PAGE_SIZE = 50;

/**
 * What a chat list shows for the paginated query it reads. While the first page
 * of a new search loads, it shows the rows it settled on before, so the list
 * never goes blank or fills with placeholder rows. `loadMore` is there only
 * while another page can be loaded: not while one is on its way, so the end of
 * a list that stays in view asks for one page at a time.
 */
export function readChatList<Item, E>(
  settled: readonly Item[],
  pagination: PaginatedQueryResult.Variants<Item, E>
) {
  return {
    loadMore: PaginatedQueryResult.isCanLoadMore(pagination)
      ? () => pagination.loadMore(CHAT_LIST_PAGE_SIZE)
      : undefined,
    results: PaginatedQueryResult.isLoadingFirstPage(pagination)
      ? settled
      : pagination.results,
  };
}
