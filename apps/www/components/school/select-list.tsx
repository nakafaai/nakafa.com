"use client";

import refs from "@repo/backend/confect/_generated/refs";
import { toConvexReference } from "@repo/backend/confect/modules/shared/convexReferences";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { useConvexAuth, usePaginatedQuery } from "convex/react";
import { useTranslations } from "next-intl";

/** Render the paginated school selection list for users with many schools. */
export function SchoolSelectList() {
  const t = useTranslations("School.Onboarding");
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { results, status, loadMore } = usePaginatedQuery(
    toConvexReference(refs.public.schools.queries.getMySchoolsPage),
    isAuthenticated && !isLoading ? {} : "skip",
    { initialNumItems: 20 }
  );

  if (status === "LoadingFirstPage") {
    return null;
  }

  return (
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

      {status === "CanLoadMore" ? (
        <Intersection onIntersect={() => loadMore(20)} />
      ) : null}
    </section>
  );
}
