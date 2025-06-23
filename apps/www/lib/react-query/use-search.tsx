import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { PagefindResult, PagefindSearchOptions } from "@/types/pagefind";
import { usePagefind } from "../context/use-pagefind";

const HTML_EXT_REGEX = /\.html$/;
const HTML_ANCHOR_REGEX = /\.html#/;
const SEARCH_OPTIONS: PagefindSearchOptions = {};

const fetchSearchResults = async (query: string): Promise<PagefindResult[]> => {
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

  return data.map((newData) => ({
    ...newData,
    sub_results: newData.sub_results.map((r) => {
      const url = r.url
        .replace(HTML_EXT_REGEX, "")
        .replace(HTML_ANCHOR_REGEX, "#");
      return { ...r, url };
    }),
  }));
};

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
