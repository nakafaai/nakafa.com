"use client";

import type { PaginatedQueryResult } from "@confect/react";
import { Array as Arr, HashSet } from "effect";
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
export function useChatList<Item extends { readonly _id: string }, E>(
  pagination: PaginatedQueryResult.Variants<Item, E>,
  search?: string
) {
  const [settled, setSettled] = useState(pagination.results);
  const [asked, setAsked] = useState({
    empties: 0,
    known: HashSet.empty<string>(),
    search,
  });
  const list = readChatList(settled, pagination);
  if (list.results !== settled) {
    setSettled(list.results);
  }
  if (asked.search !== search) {
    setAsked({ empties: 0, known: HashSet.empty<string>(), search });
  }
  const ids = Arr.map(list.results, (chat) => chat._id);
  const next = list.loadMore;
  // Asking for a window notes which chats the list holds, so the next render
  // can tell whether that window added any.
  const ask = next
    ? () => {
        setAsked({
          empties: emptyWindows(asked.known, asked.empties, ids),
          known: HashSet.fromIterable(ids),
          search,
        });
        next();
      }
    : undefined;
  const stopped = searchStopped(asked.known, asked.empties, ids);
  return {
    loadMore: stopped ? undefined : ask,
    results: list.results,
    searchFurther: stopped ? ask : undefined,
  };
}
