"use client";

import type { Ref } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import refs from "@repo/backend/confect/_generated/refs";
import { NAKAFA_AGENT_DEFAULT_LIMIT } from "@repo/contents/agent/search";

import { useLocale } from "next-intl";
import { isActiveLocale } from "@/lib/i18n/active";

type ContentSearchResponse = Ref.Returns<
  typeof refs.public.contents.queries.search.search
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
  const shouldSearch =
    enabled && normalizedQuery.length > 0 && isActiveLocale(locale);
  const state = useQuery(
    refs.public.contents.queries.search.search,
    shouldSearch
      ? {
          limit: NAKAFA_AGENT_DEFAULT_LIMIT,
          locale,
          offset: 0,
          queries: [normalizedQuery],
        }
      : "skip"
  );

  if (!shouldSearch) {
    return {
      data: [],
      error: null,
      isError: false,
      isLoading: false,
    };
  }

  if (QueryResult.isFailure(state)) {
    return {
      data: [],
      error: state.error,
      isError: true,
      isLoading: false,
    };
  }

  if (QueryResult.isSuccess(state)) {
    return {
      data: state.value.items,
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
