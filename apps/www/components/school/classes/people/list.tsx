"use client";

import type { Ref } from "@confect/core";
import { PaginatedQueryResult, useStreamPaginatedQuery } from "@confect/react";
import { StudentIcon, TeacherIcon } from "@hugeicons/core-free-icons";
import { useDebouncedValue } from "@mantine/hooks";
import classes from "@repo/backend/confect/_generated/refs/classes";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Badge } from "@repo/design-system/components/ui/badge";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";
import { useState } from "react";
import { useConvexAuth } from "@/components/providers/convex";
import { DataFailure } from "@/components/shared/failure";
import { searchParsers } from "@/lib/nuqs/search";
import { useClass } from "@/lib/school/classes/context";
import { getInitialName } from "@/lib/utils/helper";

const DEBOUNCE_TIME = 500;

/** Render the paginated class roster for the active class. */
export function SchoolClassesPeopleList({
  initialPage,
  initialQuery,
}: {
  initialPage: Ref.Returns<typeof classes.roster.list>;
  initialQuery: string;
}) {
  const t = useTranslations("School.Classes");
  const { pagination, visible, failed, isLoading, isAuthenticated, pending } =
    usePeople(initialPage, initialQuery);
  if (!(isLoading || isAuthenticated)) {
    return <DataFailure />;
  }
  const { results } = visible;
  if (failed && results.length === 0) {
    return <DataFailure />;
  }
  if (results.length === 0 && visible.exhausted) {
    return (
      <div aria-busy={pending} className="py-12">
        <p className="text-center text-muted-foreground text-sm">
          {t("no-people-found")}
        </p>
      </div>
    );
  }
  return (
    <div aria-busy={pending}>
      {PaginatedQueryResult.isFailure(pagination) && <DataFailure />}
      {results.length > 0 && (
        <section className="flex flex-col divide-y overflow-hidden rounded-md border shadow-sm">
          {Arr.map(results, (person) => (
            <article
              className="flex items-center justify-between gap-4 p-4"
              key={person._id}
            >
              <div className="flex flex-1 items-center gap-2">
                <Avatar>
                  <AvatarImage
                    alt={person.user.name}
                    src={person.user.image ?? ""}
                  />
                  <AvatarFallback>
                    {getInitialName(person.user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <p className="truncate font-medium text-foreground">
                    {person.user.name}
                  </p>
                  <span className="truncate text-muted-foreground">
                    {person.user.email}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  variant={person.role === "teacher" ? "secondary" : "muted"}
                >
                  <HugeIcons
                    icon={person.role === "teacher" ? TeacherIcon : StudentIcon}
                  />
                  {t(person.role)}
                </Badge>
              </div>
            </article>
          ))}
        </section>
      )}
      {PaginatedQueryResult.isCanLoadMore(pagination) && (
        <Intersection onIntersect={() => pagination.loadMore(50)} />
      )}
    </div>
  );
}

/** Retains the last real roster while its search subscription changes. */
function usePeople(
  initialPage: Ref.Returns<typeof classes.roster.list>,
  initialQuery: string
) {
  const classId = useClass((state) => state.class._id);
  const [{ q }] = useQueryStates(searchParsers);
  const [debouncedQ] = useDebouncedValue(q, DEBOUNCE_TIME);
  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  const isLoading = useConvexAuth((auth) => auth.isLoading);
  const pagination = useStreamPaginatedQuery(
    classes.roster.list,
    isAuthenticated && !isLoading
      ? {
          classId,
          q: debouncedQ,
        }
      : "skip",
    {
      initialNumItems: 50,
    }
  );
  const loading = PaginatedQueryResult.isLoadingFirstPage(pagination);
  const failed = PaginatedQueryResult.isFailure(pagination);
  const [retained, setRetained] = useState<{
    classId: typeof classId;
    query: string;
    results: typeof pagination.results;
    exhausted: boolean;
  }>({
    classId,
    query: initialQuery,
    results: initialPage.page,
    exhausted: initialPage.isDone,
  });
  let visible = retained;
  if (retained.classId !== classId) {
    visible = {
      classId,
      query: initialQuery,
      results: initialPage.page,
      exhausted: initialPage.isDone,
    };
    setRetained(visible);
  } else if (!(loading || failed) && retained.results !== pagination.results) {
    visible = {
      classId,
      query: debouncedQ,
      results: pagination.results,
      exhausted: PaginatedQueryResult.isExhausted(pagination),
    };
    setRetained(visible);
  }
  return {
    pagination,
    visible,
    loading,
    failed,
    isLoading,
    isAuthenticated,
    pending: loading || q !== visible.query,
  };
}
