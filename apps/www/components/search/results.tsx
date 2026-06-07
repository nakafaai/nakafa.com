"use client";

import { useDebouncedValue } from "@mantine/hooks";
import { useQueryStates } from "nuqs";
import { SearchResults } from "@/components/shared/search-results";
import { useSearchQuery } from "@/lib/content/use-search-query";
import { searchParsers } from "@/lib/nuqs/search";
import { getErrorMessage } from "@/lib/utils/error";

const DEBOUNCE_TIME = 500;

export function SearchListItems() {
  const [{ q }] = useQueryStates(searchParsers);

  const [debouncedQuery] = useDebouncedValue(q, DEBOUNCE_TIME);

  const {
    data: results = [],
    isError,
    error,
    isLoading,
  } = useSearchQuery({
    query: debouncedQuery,
    enabled: Boolean(debouncedQuery),
  });

  const hasError = isError;
  const displayError = error ? getErrorMessage(error) : "";
  const queryLoading = isLoading && !hasError;

  return (
    <SearchResults
      error={displayError}
      isError={hasError}
      isLoading={queryLoading}
      query={debouncedQuery}
      results={results}
    />
  );
}
