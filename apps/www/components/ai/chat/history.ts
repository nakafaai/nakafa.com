import { PaginatedQueryResult } from "@confect/react";
import {
  CHAT_LIST_PAGE_SIZE,
  CHAT_SEARCH_EMPTY_WINDOWS,
} from "@repo/backend/client/chats/list";

/**
 * The windows of a search in a row that held no chat, the one asked for last
 * included. `base` is how many chats the list held when that window was asked
 * for, and `empties` the windows in a row before it that held none. The window
 * is empty when the list holds no more chats than it did.
 */
export function emptyWindows(base: number, empties: number, length: number) {
  return length <= base ? empties + 1 : 0;
}

/**
 * Whether a search has run through `CHAT_SEARCH_EMPTY_WINDOWS` windows in a row
 * without a match, so the list stops asking for the next one by itself. Each
 * window reads and opens the titles of many chats, and a search that matches
 * nothing would otherwise walk the whole account.
 */
export function searchStopped(base: number, empties: number, length: number) {
  return emptyWindows(base, empties, length) >= CHAT_SEARCH_EMPTY_WINDOWS;
}

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
