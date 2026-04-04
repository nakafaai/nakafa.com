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
import { getEffectiveTryoutStatus } from "@/components/tryout/utils/status";

type ActiveTryoutCatalogEntry = FunctionReturnType<
  typeof api.tryouts.queries.tryouts.getActiveTryoutCatalogPage
>["page"][number];

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

interface TryoutCatalogListProps {
  locale: Locale;
  product: TryoutProduct;
}

export function TryoutCatalogList({ locale, product }: TryoutCatalogListProps) {
  const tTryouts = useTranslations("Tryouts");
  const { loadMore, results, status } = usePaginatedQuery(
    api.tryouts.queries.tryouts.getActiveTryoutCatalogPage,
    {
      locale,
      product,
    },
    { initialNumItems: 25 }
  );
  const nowMs = useTryoutClock(
    results.some((entry) => entry.latestAttempt?.status === "in-progress")
  );

  if (results.length === 0) {
    if (status === "LoadingFirstPage") {
      return null;
    }

    return <TryoutPackageEmpty>{tTryouts("list-empty")}</TryoutPackageEmpty>;
  }

  const cycleGroups = groupCatalogEntriesByCycle(results);

  return (
    <div>
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
              const effectiveStatus = tryout.latestAttempt
                ? getEffectiveTryoutStatus({
                    expiresAtMs: tryout.latestAttempt.expiresAtMs,
                    nowMs,
                    status: tryout.latestAttempt.status,
                  })
                : null;
              let badgeStatus: "completed" | "in-progress" | null = null;

              if (effectiveStatus === "in-progress") {
                badgeStatus = "in-progress";
              } else if (effectiveStatus !== null) {
                badgeStatus = "completed";
              }

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

      {status === "CanLoadMore" ? (
        <Intersection onIntersect={() => loadMore(25)} />
      ) : null}
    </div>
  );
}
