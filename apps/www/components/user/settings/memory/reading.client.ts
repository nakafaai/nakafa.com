"use client";

import {
  PaginatedQueryResult,
  QueryResult,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import nina from "@repo/backend/confect/_generated/refs/nina";
import { Array as Arr } from "effect";
import { useConvexAuth } from "@/components/providers/convex";
import {
  MEMORY_PAGE,
  type MemoryPage,
} from "@/components/user/settings/memory/list";

/**
 * The pages of the list that the browser has loaded, in list order. The page
 * the server read stands in until Convex answers with the first one. `whole`
 * tells that every memory is loaded, and `more` loads the next page of a size
 * the caller names, or is none when there is nothing to load or a page is on
 * its way.
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
    more: PaginatedQueryResult.isCanLoadMore(pages) ? pages.loadMore : null,
    whole: starting ? first.isDone : PaginatedQueryResult.isExhausted(pages),
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
 * Reads what Convex says about the learner's memories, so that no component
 * knows about pages or cursors. It must run once for the page, because the
 * pages a learner loaded belong to the hook that loaded them.
 *
 * It returns `loaded` (every memory the page has loaded, in list order),
 * `whole` (every memory is loaded), `more` (loads the next page, or none),
 * `empty` (the learner has no memory at all) and `paused`. What the learner
 * searches for is not here: the browser's own filter narrows `loaded`.
 */
export function useMemoryReading(first: MemoryPage, paused: boolean) {
  const { loaded, more, whole } = useMemoryPages(first);
  const isPaused = useMemoryPaused(paused);

  return {
    empty: Arr.isReadonlyArrayEmpty(loaded) && whole,
    loaded,
    more,
    paused: isPaused,
    whole,
  };
}

/** What the Memory page reads, as `useMemoryReading` returns it. */
export type MemoryReading = ReturnType<typeof useMemoryReading>;
