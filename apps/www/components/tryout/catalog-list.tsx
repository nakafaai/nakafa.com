"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { TryoutProduct } from "@repo/backend/convex/tryouts/products";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { usePaginatedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { useTryoutClock } from "@/components/tryout/hooks/use-tryout-clock";
import {
  TryoutPackageCopy,
  TryoutPackageEmpty,
  TryoutPackageHeader,
  TryoutPackageItems,
  TryoutPackageLink,
  TryoutPackageMeta,
  TryoutPackageTitle,
  TryoutPackageYear,
} from "@/components/tryout/package-list";
import { TryoutStatusBadge } from "@/components/tryout/status-badge";
import { TRYOUT_CATALOG_PAGE_SIZE } from "@/components/tryout/utils/catalog";
import { getEffectiveTryoutStatus } from "@/components/tryout/utils/status";

type ActiveTryoutCatalogPage = FunctionReturnType<
  typeof api.tryouts.queries.tryouts.getActiveTryoutCatalogPage
>;
type ActiveTryoutCatalogEntry = ActiveTryoutCatalogPage["page"][number];

/** Groups already ordered catalog rows into the year sections shown in the UI. */
function groupCatalogEntriesByCycle(
  entries: readonly ActiveTryoutCatalogEntry[]
) {
  const groups = new Map<string, ActiveTryoutCatalogEntry[]>();

  for (const entry of entries) {
    const cycleEntries = groups.get(entry.cycleKey);

    if (cycleEntries) {
      cycleEntries.push(entry);
      continue;
    }

    groups.set(entry.cycleKey, [entry]);
  }

  return Array.from(groups.entries()).map(([cycleKey, tryouts]) => ({
    cycleKey,
    tryouts,
  }));
}

/** Maps one stored latest-attempt summary to the compact badge shown in the hub. */
function getTryoutCatalogBadgeStatus({
  latestStatus,
  nowMs,
}: {
  latestStatus: ActiveTryoutCatalogEntry["latestAttempt"];
  nowMs: number;
}) {
  if (!latestStatus) {
    return null;
  }

  const effectiveStatus = getEffectiveTryoutStatus({
    expiresAtMs: latestStatus.expiresAtMs,
    nowMs,
    status: latestStatus.status,
  });

  if (effectiveStatus === "in-progress") {
    return "in-progress" as const;
  }

  if (effectiveStatus !== null) {
    return "completed" as const;
  }

  return null;
}

interface TryoutCatalogListProps {
  initialEntries: readonly ActiveTryoutCatalogEntry[];
  locale: Locale;
  product: TryoutProduct;
}

/** Renders the paginated tryout catalog for the hub and product pages. */
export function TryoutCatalogList({
  initialEntries,
  locale,
  product,
}: TryoutCatalogListProps) {
  const tTryouts = useTranslations("Tryouts");
  const {
    loadMore,
    results: catalogEntries,
    status: catalogStatus,
  } = usePaginatedQuery(
    api.tryouts.queries.tryouts.getActiveTryoutCatalogPage,
    {
      locale,
      product,
    },
    {
      initialNumItems: TRYOUT_CATALOG_PAGE_SIZE,
    }
  );
  const displayedEntries =
    catalogEntries.length > 0 ? catalogEntries : initialEntries;
  const nowMs = useTryoutClock(
    displayedEntries.some(
      (entry) => entry.latestAttempt?.status === "in-progress"
    )
  );

  if (displayedEntries.length === 0) {
    return <TryoutPackageEmpty>{tTryouts("list-empty")}</TryoutPackageEmpty>;
  }

  const cycleGroups = groupCatalogEntriesByCycle(displayedEntries);

  return (
    <div className="border-t">
      {cycleGroups.map((group, index) => (
        <div
          className={index > 0 ? "border-t" : undefined}
          key={group.cycleKey}
        >
          <TryoutPackageYear>
            {tTryouts("year-title", { year: group.cycleKey })}
          </TryoutPackageYear>

          <TryoutPackageItems>
            {group.tryouts.map((tryout) => {
              const badgeStatus = getTryoutCatalogBadgeStatus({
                latestStatus: tryout.latestAttempt,
                nowMs,
              });

              return (
                <TryoutPackageLink
                  href={`/try-out/${product}/${tryout.slug}`}
                  key={tryout.tryoutId}
                >
                  <TryoutPackageCopy>
                    <TryoutPackageHeader>
                      <TryoutPackageTitle>{tryout.label}</TryoutPackageTitle>
                      {badgeStatus ? (
                        <TryoutStatusBadge status={badgeStatus} />
                      ) : null}
                    </TryoutPackageHeader>
                    <TryoutPackageMeta>
                      {tTryouts("available-item-description", {
                        parts: tryout.partCount,
                        questions: tryout.totalQuestionCount,
                      })}
                    </TryoutPackageMeta>
                  </TryoutPackageCopy>
                </TryoutPackageLink>
              );
            })}
          </TryoutPackageItems>
        </div>
      ))}

      {catalogStatus === "CanLoadMore" ? (
        <Intersection onIntersect={() => loadMore(TRYOUT_CATALOG_PAGE_SIZE)} />
      ) : null}
    </div>
  );
}
