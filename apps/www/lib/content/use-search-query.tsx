"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { useQuery_experimental as useConvexQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useLocale } from "next-intl";

const SEARCH_LIMIT = 20;

type ContentSearchResponse = FunctionReturnType<
  typeof api.contents.queries.search.search
>;

export type ContentSearchResultItem = ContentSearchResponse["items"][number];

/** Runs the public Convex content search query for the active locale. */
export function useSearchQuery({
  enabled,
  query,
}: {
  enabled: boolean;
  query: string;
}) {
  const locale = useLocale();
  const normalizedQuery = query.trim();
  const shouldSearch = enabled && normalizedQuery.length > 0;
  const state = useConvexQuery({
    query: api.contents.queries.search.search,
    args: shouldSearch
      ? {
          limit: SEARCH_LIMIT,
          locale,
          offset: 0,
          queries: [normalizedQuery],
        }
      : "skip",
  });

  if (!shouldSearch) {
    return {
      data: [],
      error: null,
      isError: false,
      isLoading: false,
    };
  }

  if (state.status === "error") {
    return {
      data: [],
      error: state.error,
      isError: true,
      isLoading: false,
    };
  }

  if (state.status === "success") {
    return {
      data: state.data.items,
      error: null,
      isError: false,
      isLoading: false,
    };
  }

  return {
    data: [],
    error: null,
    isError: false,
    isLoading: true,
  };
}
