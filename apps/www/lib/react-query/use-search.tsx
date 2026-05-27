import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Effect } from "effect";
import { usePagefind } from "@/lib/context/use-pagefind";
import { normalizePagefindResult } from "@/lib/utils/pagefind";
import type { PagefindResult, PagefindSearchOptions } from "@/types/pagefind";

const SEARCH_OPTIONS: PagefindSearchOptions = {};

class PagefindNotReadyError extends Error {
  override name = "PagefindNotReadyError";
}

class PagefindSearchError extends Error {
  override name = "PagefindSearchError";
}

/** Query Pagefind and normalize the result payload for the search UI. */
const searchPagefind = Effect.fn("www.search.pagefind")(function* (
  query: string
) {
  const pagefind = window.pagefind;

  if (!pagefind?.debouncedSearch) {
    return yield* Effect.fail(
      new PagefindNotReadyError("Pagefind not initialized correctly.")
    );
  }

  const response = yield* Effect.tryPromise({
    try: () => pagefind.debouncedSearch<PagefindResult>(query, SEARCH_OPTIONS),
    catch: (cause) =>
      new PagefindSearchError("Unable to search Pagefind.", {
        cause,
      }),
  });

  if (!response) {
    return [];
  }

  const data = yield* Effect.forEach(response.results, (result) =>
    Effect.tryPromise({
      try: () => result.data(),
      catch: (cause) =>
        new PagefindSearchError("Unable to load Pagefind search result.", {
          cause,
        }),
    })
  );

  return data.map(normalizePagefindResult);
});

/** Return a cached React Query handle for Pagefind search results. */
export function useSearchQuery({
  query,
  enabled,
}: {
  query: string;
  enabled: boolean;
}) {
  const pagefindReady = usePagefind((context) => context.ready);

  return useQuery({
    queryKey: ["search", query],
    queryFn: () => Effect.runPromise(searchPagefind(query)),
    enabled: pagefindReady && enabled,
    placeholderData: keepPreviousData,
  });
}
