"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import type { Preloaded } from "convex/react";
import { usePaginatedQuery, usePreloadedQuery } from "convex/react";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { TryoutList } from "@/components/tryout/catalog/list";
import { getTryoutPublicPathHref } from "@/components/tryout/route/path";

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
    api.tryouts.queries.sets.list,
    page
      ? {
          countryKey: page.country.countryKey,
          examKey: page.exam.examKey,
          locale,
          sort: { direction: "asc", field: "order" },
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
                {set.visibleSectionCount > 0 ? (
                  <Badge variant="muted">
                    {tTryouts("section-count", {
                      count: set.visibleSectionCount,
                    })}
                  </Badge>
                ) : null}
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
