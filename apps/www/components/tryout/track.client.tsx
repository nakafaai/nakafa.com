"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import type { Preloaded } from "convex/react";
import { usePaginatedQuery, usePreloadedQuery } from "convex/react";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { TryoutList } from "@/components/tryout/list";
import { getTryoutPublicPathHref } from "@/components/tryout/routes";

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
  const tTryouts = useTranslations("Tryouts");
  const { loadMore, results, status } = usePaginatedQuery(
    api.tryouts.queries.catalog.listTrackSets,
    page
      ? {
          countryKey: page.country.countryKey,
          examKey: page.exam.examKey,
          locale,
          trackKey: page.track.trackKey,
        }
      : "skip",
    { initialNumItems: 20 }
  );

  if (!page || status === "LoadingFirstPage") {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 pt-6 pb-24">
      <div className="space-y-4">
        <TryoutList
          emptyLabel={tTryouts("list-empty")}
          rows={results.map((set) => ({
            href: getTryoutPublicPathHref(set.publicPath),
            key: set.setKey,
            meta: (
              <>
                <Badge variant="muted">
                  {tTryouts("question-count", {
                    count: set.readyQuestionCount,
                  })}
                </Badge>
                <Badge variant="muted">
                  {tTryouts("section-count", {
                    count: set.visibleSectionCount,
                  })}
                </Badge>
              </>
            ),
            title: set.title,
            visual: {
              keyString: set.publicPath,
              kind: "gradient",
            },
          }))}
        />
        {status === "CanLoadMore" ? (
          <Intersection onIntersect={() => loadMore(20)} />
        ) : null}
      </div>
    </div>
  );
}
