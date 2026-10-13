import { PaginatedQueryResult } from "@confect/react";
import {
  CHAT_LIST_PAGE_SIZE,
  CHAT_SEARCH_EMPTY_WINDOWS,
} from "@repo/backend/client/chats/list";
import { Array as Arr, HashSet } from "effect";

/**
 * The windows of a search in a row that held no chat, the one asked for last
 * included. `known` holds the ids of the chats the list held when that window
 * was asked for, `empties` the windows in a row before it that held none, and
 * `ids` those of the chats the list holds now. The window is empty when the
 * list holds no chat that was not known. It counts the chats that came in and
 * not how many the list holds, so a chat that left the list while the window
 * loaded, deleted in another tab, does not hide a match the window brought.
 */
export function emptyWindows(
  known: HashSet.HashSet<string>,
  empties: number,
  ids: readonly string[]
) {
  return Arr.some(ids, (id) => !HashSet.has(known, id)) ? 0 : empties + 1;
}

/**
 * Whether a search has run through `CHAT_SEARCH_EMPTY_WINDOWS` windows in a row
 * without a match, so the list stops asking for the next one by itself. Each
 * window reads and opens the titles of many chats, and a search that matches
 * nothing would otherwise walk the whole account.
 */
export function searchStopped(
  known: HashSet.HashSet<string>,
  empties: number,
  ids: readonly string[]
) {
  return emptyWindows(known, empties, ids) >= CHAT_SEARCH_EMPTY_WINDOWS;
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
