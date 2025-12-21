"use client";

import { getErrorMessage, usePagefind } from "@/lib/context/use-pagefind";
import { useSearchQuery } from "@/lib/react-query/use-search";
import { SearchResults } from "../shared/search-results";

interface Props {
  query: string;
}

export function AskListItems({ query }: Props) {
  const pagefindError = usePagefind((context) => context.error);

  const {
    data: results = [],
    isError,
    error,
    isLoading,
    isPlaceholderData,
  } = useSearchQuery({
    query,
    enabled: Boolean(query),
  });

  const hasError = isError || Boolean(pagefindError);
  const displayError = pagefindError || (error ? getErrorMessage(error) : "");
  const queryLoading = isLoading && !hasError && !isPlaceholderData;

  return (
    <SearchResults
      error={displayError}
      isError={hasError}
      isLoading={queryLoading}
      query={query}
      results={results}
    />
  );
}
