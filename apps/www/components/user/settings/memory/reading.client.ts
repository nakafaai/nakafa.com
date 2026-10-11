"use client";

import {
  PaginatedQueryResult,
  QueryResult,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import { useDebouncedValue } from "@mantine/hooks";
import nina from "@repo/backend/confect/_generated/refs/nina";
import { Duration, Option, String as Str } from "effect";
import { useConvexAuth } from "@/components/providers/convex";
import {
  findMemory,
  listedMemories,
  MEMORY_PAGE,
  type Memory,
  type MemoryPage,
  searchText,
} from "@/components/user/settings/memory/list";

/** How long the search waits after the last key before it asks the server. */
const PAUSE = Duration.millis(300);
/** What the server found while it is not asked or has not answered. */
const NOTHING: readonly Memory[] = [];

/**
 * The pages of the list that the browser has loaded, in list order. The page
 * the server read stands in until Convex answers with the first one. `whole`
 * tells that every memory is loaded, and `more` loads the next page when there
 * is one.
 */
function useMemoryPages(first: MemoryPage) {
  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  const pages = usePaginatedQuery(
    nina.memory.list,
    isAuthenticated ? {} : "skip",
    { initialNumItems: MEMORY_PAGE }
  );
  const starting = PaginatedQueryResult.isLoadingFirstPage(pages);

  return {
    loaded: starting ? first.page : pages.results,
    more: PaginatedQueryResult.isCanLoadMore(pages)
      ? () => pages.loadMore(MEMORY_PAGE)
      : null,
    whole: starting ? first.isDone : PaginatedQueryResult.isExhausted(pages),
  };
}

/**
 * What the server's search finds for the text, asked a moment after the last
 * key and only when `asks`. `answered` tells that the answer is for the text on
 * screen, or that the server was not asked at all.
 */
function useMemoryFound(query: string, asks: boolean) {
  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  const [pause] = useDebouncedValue(query, Duration.toMillis(PAUSE));
  const text = searchText(pause);
  const found = useQuery(
    nina.memory.search,
    isAuthenticated && asks && !Str.isEmpty(text) ? { query: text } : "skip"
  );
  const success = QueryResult.isSuccess(found);

  return {
    answer: success ? found.value : NOTHING,
    answered: !asks || (success && text === searchText(query)),
  };
}

/** Whether memory is paused. The value the server read stands in until Convex answers. */
function useMemoryPaused(start: boolean) {
  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  const state = useQuery(nina.memory.state, isAuthenticated ? {} : "skip");

  return QueryResult.isSuccess(state) && state.value !== null
    ? state.value.paused
    : start;
}

/**
 * Reads everything the Memory page shows from where it lives, so that no
 * component knows about pages, cursors or two queries. It must run once for
 * the page, because the pages a learner loaded belong to the hook that loaded
 * them.
 *
 * A search lists the memories the browser holds that match, then the ones the
 * server finds on pages the browser has not loaded. The server is not asked
 * when every memory is loaded, because the browser's filter is complete then,
 * and no page loads while the learner searches, because the server's search
 * already reaches the rest.
 *
 * It returns `shown` (what the list shows), `loaded` (every memory the page
 * holds), `find` (one memory by id from everything the page holds), `paused`,
 * `more` (loads the next page, or none), `empty` (the learner has no memory)
 * and `nothing` (the search is answered and found none).
 */
export function useMemoryReading(
  first: MemoryPage,
  paused: boolean,
  query: string
) {
  const { loaded, more, whole } = useMemoryPages(first);
  const searching = !Str.isEmpty(Str.trim(query));
  const { answer, answered } = useMemoryFound(query, searching && !whole);
  const isPaused = useMemoryPaused(paused);
  const shown = listedMemories(loaded, query, answer);
  const empty = loaded.length === 0 && whole;

  return {
    empty,
    find: (id: Memory["id"]) =>
      Option.getOrUndefined(
        Option.orElse(findMemory(loaded, id), () => findMemory(answer, id))
      ),
    loaded,
    more: searching ? null : more,
    nothing: searching && !empty && answered && shown.length === 0,
    paused: isPaused,
    shown,
  };
}

/** What the Memory page reads, as `useMemoryReading` returns it. */
export type MemoryReading = ReturnType<typeof useMemoryReading>;
