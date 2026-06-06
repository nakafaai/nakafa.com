"use client";

import { useDebouncedValue } from "@mantine/hooks";
import { useQueryStates } from "nuqs";
import { SearchResults } from "@/components/shared/search-results";
import { usePagefind } from "@/lib/context/use-pagefind";
import { searchParsers } from "@/lib/nuqs/search";
import { useSearchQuery } from "@/lib/react-query/use-search";
import { getErrorMessage } from "@/lib/utils/error";

const DEBOUNCE_TIME = 500;

export function SearchListItems() {
  const pagefindError = usePagefind((context) => context.error);

  const [{ q }] = useQueryStates(searchParsers);

  const [debouncedQuery] = useDebouncedValue(q, DEBOUNCE_TIME);

  const {
    data: results = [],
    isError,
    error,
    isLoading,
    isPlaceholderData,
  } = useSearchQuery({
    query: debouncedQuery,
    enabled: Boolean(debouncedQuery),
  });

  const hasError = isError || Boolean(pagefindError);
  const displayError = pagefindError || (error ? getErrorMessage(error) : "");
  const queryLoading = isLoading && !hasError && !isPlaceholderData;

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
