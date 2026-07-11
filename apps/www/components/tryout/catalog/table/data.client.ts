"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { usePaginatedQuery } from "convex/react";
import type { Locale } from "next-intl";
import { useEffect } from "react";
import { readTryoutSetAttemptStatus } from "@/components/tryout/catalog/table/filter";
import type {
  TryoutSetRow,
  TryoutSetSort,
  TryoutSetStatusFilter,
  TryoutTrackPage,
} from "@/components/tryout/catalog/table/types";
import { TRYOUT_SET_PAGE_SIZE } from "@/components/tryout/catalog/table/types";

interface TryoutSetData {
  readonly busy: boolean;
  readonly exhausted: boolean;
  readonly loadKey: string;
  readonly loadMore: () => void;
  readonly pending: boolean;
  readonly rows: TryoutSetRow[];
}

/** Loads one reactive cursor for the active catalog sort or status filter. */
export function useTryoutSetData({
  locale,
  page,
  statusFilter,
  sort,
}: {
  locale: Locale;
  page: TryoutTrackPage;
  statusFilter: TryoutSetStatusFilter;
  sort: TryoutSetSort;
}): TryoutSetData {
  const identity = {
    countryKey: page.country.countryKey,
    examKey: page.exam.examKey,
    locale,
    trackKey: page.track.trackKey,
  };
  const attemptStatus = readTryoutSetAttemptStatus(statusFilter);
  const catalog = usePaginatedQuery(
    api.tryouts.queries.sets.list,
    statusFilter === "all" ? { ...identity, sort } : "skip",
    { initialNumItems: TRYOUT_SET_PAGE_SIZE }
  );
  const byStatus = usePaginatedQuery(
    api.tryouts.queries.sets.byStatus,
    attemptStatus ? { ...identity, status: attemptStatus } : "skip",
    { initialNumItems: TRYOUT_SET_PAGE_SIZE }
  );
  const unattempted = usePaginatedQuery(
    api.tryouts.queries.sets.unattempted,
    statusFilter === "not-started" ? identity : "skip",
    { initialNumItems: TRYOUT_SET_PAGE_SIZE }
  );
  let active = catalog;

  if (statusFilter === "not-started") {
    active = unattempted;
  }

  if (attemptStatus) {
    active = byStatus;
  }

  const rows = active.results;
  const canLoadMore = active.status === "CanLoadMore";

  useEffect(() => {
    if (rows.length > 0 || !canLoadMore) {
      return;
    }

    active.loadMore(TRYOUT_SET_PAGE_SIZE);
  }, [active, canLoadMore, rows.length]);

  return {
    busy:
      active.status === "LoadingFirstPage" || active.status === "LoadingMore",
    exhausted: active.status === "Exhausted",
    loadKey: `${statusFilter}:${sort.field}:${sort.direction}:${rows.length}:${active.status}`,
    loadMore: () => {
      if (active.status === "CanLoadMore") {
        active.loadMore(TRYOUT_SET_PAGE_SIZE);
      }
    },
    pending: rows.length === 0 && active.status !== "Exhausted",
    rows,
  };
}
