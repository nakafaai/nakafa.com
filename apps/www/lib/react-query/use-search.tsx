import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { normalizePagefindResult } from "@/lib/utils/pagefind";
import type { PagefindResult, PagefindSearchOptions } from "@/types/pagefind";
import { usePagefind } from "../context/use-pagefind";

const SEARCH_OPTIONS: PagefindSearchOptions = {};

async function fetchSearchResults(query: string): Promise<PagefindResult[]> {
  if (!window.pagefind?.debouncedSearch) {
    // Should not happen if isPagefindReady is true, but good practice
    throw new Error("Pagefind not initialized correctly.");
  }

  const response = await window.pagefind.debouncedSearch<PagefindResult>(
    query,
    SEARCH_OPTIONS
  );

  if (!response) {
    return [];
  }

  const data = await Promise.all(response.results.map((o) => o.data()));

  return data.map(normalizePagefindResult);
}

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
    queryFn: () => fetchSearchResults(query),
    enabled: pagefindReady && enabled,
    placeholderData: keepPreviousData,
  });
}
