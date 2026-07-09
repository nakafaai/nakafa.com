"use client";

import type { api } from "@repo/backend/convex/_generated/api";
import type { Preloaded } from "convex/react";
import { usePreloadedQuery } from "convex/react";
import type { Locale } from "next-intl";
import { TryoutSetTable } from "@/components/tryout/catalog/table/table.client";

type TrackPageQuery = typeof api.tryouts.queries.catalog.getTrackPage;

/** Renders one realtime try-out track page with paginated set discovery. */
export function TryoutTrackPageClient({
  locale,
  preloaded,
}: {
  locale: Locale;
  preloaded: Preloaded<TrackPageQuery>;
}) {
  const page = usePreloadedQuery(preloaded);

  if (!page) {
    return null;
  }

  return (
    <TryoutSetTable
      key={`${locale}:${page.track.publicPath}`}
      locale={locale}
      page={page}
    />
  );
}
