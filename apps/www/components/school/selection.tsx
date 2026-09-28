"use client";

import type { Ref } from "@confect/core";
import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import refs from "@repo/backend/confect/_generated/refs";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { useConvexAuth } from "convex/react";
import { useTranslations } from "next-intl";
import { DataFailure } from "@/components/shared/failure";

/** Render the paginated school selection list for users with many schools. */
export function SchoolSelectList({
  initialSchoolPage,
}: {
  initialSchoolPage: Ref.Returns<
    typeof refs.public.schools.queries.getMySchoolsPage
  >;
}) {
  const t = useTranslations("School.Onboarding");
  const { isAuthenticated, isLoading } = useConvexAuth();
  const pagination = usePaginatedQuery(
    refs.public.schools.queries.getMySchoolsPage,
    isAuthenticated && !isLoading ? {} : "skip",
    {
      initialNumItems: 20,
    }
  );
  const results = PaginatedQueryResult.isLoadingFirstPage(pagination)
    ? initialSchoolPage.page
    : pagination.results;
  if (
    PaginatedQueryResult.isFailure(pagination) &&
    pagination.results.length === 0
  ) {
    return <DataFailure />;
  }
  return (
    <>
      {PaginatedQueryResult.isFailure(pagination) && <DataFailure />}
      <section className="grid gap-4">
        {results.map((school) => (
          <NavigationLink
            className="flex flex-col gap-2 rounded-xl border bg-card px-5 py-4 shadow-sm transition-colors ease-out hover:border-primary/50 hover:bg-[color-mix(in_oklch,var(--primary)_1%,var(--background))]"
            href={`/school/${school.slug}`}
            key={school._id}
          >
            <h2 className="font-medium text-lg">{school.name}</h2>
            <p className="text-muted-foreground text-sm">{t(school.type)}</p>
          </NavigationLink>
        ))}

        {PaginatedQueryResult.isCanLoadMore(pagination) ? (
          <Intersection onIntersect={() => pagination.loadMore(20)} />
        ) : null}
      </section>
    </>
  );
}
