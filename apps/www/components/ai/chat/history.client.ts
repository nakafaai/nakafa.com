"use client";

import type { PaginatedQueryResult } from "@confect/react";
import { useState } from "react";
import {
  emptyWindows,
  readChatList,
  searchStopped,
} from "@/components/ai/chat/history";

/**
 * The chats a list shows, from the paginated query it reads. It remembers the
 * rows of the last page that loaded, which the list keeps showing while a new
 * search is still loading its first page.
 *
 * A search that holds no match for several windows in a row stops asking for
 * the next window by itself: `loadMore` is there until then, and `searchFurther`
 * after it, for the learner to ask for one more window. A list that is not a
 * search never stops, because each of its pages holds chats. A new `search`
 * starts the count again.
 */
export function useChatList<Item, E>(
  pagination: PaginatedQueryResult.Variants<Item, E>,
  search?: string
) {
  const [settled, setSettled] = useState(pagination.results);
  const [asked, setAsked] = useState({ base: 0, empties: 0, search });
  const list = readChatList(settled, pagination);
  if (list.results !== settled) {
    setSettled(list.results);
  }
  if (asked.search !== search) {
    setAsked({ base: 0, empties: 0, search });
  }
  const length = list.results.length;
  const next = list.loadMore;
  // Asking for a window notes how many chats the list holds, so the next
  // render can tell whether that window added any.
  const ask = next
    ? () => {
        setAsked({
          base: length,
          empties: emptyWindows(asked.base, asked.empties, length),
          search,
        });
        next();
      }
    : undefined;
  const stopped = searchStopped(asked.base, asked.empties, length);
  return {
    loadMore: stopped ? undefined : ask,
    results: list.results,
    searchFurther: stopped ? ask : undefined,
  };
}
