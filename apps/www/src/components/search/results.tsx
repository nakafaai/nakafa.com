import { useDebouncedValue } from "@mantine/hooks";
import { getRouteApi } from "@tanstack/react-router";
import { SearchResults } from "@/components/search/list";
import { getErrorMessage } from "@/lib/failure";
import { useSearchQuery } from "@/lib/search/query";

const DEBOUNCE_TIME = 500;

const searchRoute = getRouteApi("/$locale/_main/_app/search");

/** Connects the search page query string to Convex search results. */
export function SearchListItems() {
  const { q } = searchRoute.useSearch();

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
