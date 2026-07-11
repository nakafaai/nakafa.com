"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { usePaginatedQuery } from "convex/react";
import type { Locale } from "next-intl";
import { useEffect } from "react";
import type {
  TryoutSetRow,
  TryoutSetSort,
  TryoutTrackPage,
} from "@/components/tryout/catalog/table/types";

const PAGE_SIZE = 25;

interface TryoutSetData {
  readonly busy: boolean;
  readonly exhausted: boolean;
  readonly loadKey: string;
  readonly loadMore: () => void;
  readonly pending: boolean;
  readonly rows: TryoutSetRow[];
}

/** Composes reactive catalog and progress cursors into one ordered row stream. */
export function useTryoutSetData({
  locale,
  page,
  sort,
}: {
  locale: Locale;
  page: TryoutTrackPage;
  sort: TryoutSetSort;
}): TryoutSetData {
  const identity = {
    countryKey: page.country.countryKey,
    examKey: page.exam.examKey,
    locale,
    trackKey: page.track.trackKey,
  };
  const isStatusSort = sort.field === "attemptStatus";
  const catalog = usePaginatedQuery(
    api.tryouts.queries.sets.list,
    isStatusSort ? "skip" : { ...identity, sort },
    { initialNumItems: PAGE_SIZE }
  );
  const statusArgs = isStatusSort
    ? { ...identity, direction: sort.direction }
    : "skip";
  const attempted = usePaginatedQuery(
    api.tryouts.queries.sets.attempted,
    statusArgs,
    { initialNumItems: PAGE_SIZE }
  );
  const unattempted = usePaginatedQuery(
    api.tryouts.queries.sets.unattempted,
    statusArgs,
    { initialNumItems: PAGE_SIZE }
  );
  const primary = sort.direction === "asc" ? unattempted : attempted;
  const secondary = sort.direction === "asc" ? attempted : unattempted;
  const statusRows =
    primary.status === "Exhausted"
      ? [...primary.results, ...secondary.results]
      : primary.results;
  const activeStatusPage = primary.status === "Exhausted" ? secondary : primary;
  const active = isStatusSort ? activeStatusPage : catalog;
  const rows = isStatusSort ? statusRows : catalog.results;
  const canLoadMore = active.status === "CanLoadMore";

  useEffect(() => {
    if (rows.length > 0 || !canLoadMore) {
      return;
    }

    active.loadMore(PAGE_SIZE);
  }, [active, canLoadMore, rows.length]);

  return {
    busy:
      active.status === "LoadingFirstPage" || active.status === "LoadingMore",
    exhausted: active.status === "Exhausted",
    loadKey: `${sort.field}:${sort.direction}:${rows.length}:${active.status}`,
    loadMore: () => {
      if (active.status === "CanLoadMore") {
        active.loadMore(PAGE_SIZE);
      }
    },
    pending: rows.length === 0 && active.status !== "Exhausted",
    rows,
  };
}
