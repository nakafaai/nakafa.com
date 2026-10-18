"use client";

import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import { useIntersection } from "@mantine/hooks";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import { Array as Arr } from "effect";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";

/** How many exams the list asks for each time its end comes into view. */
const EXAM_PAGE_SIZE = 20;

/**
 * The exams of the school, newest first, each with its title and its language. The next
 * page loads when the end of the list comes into view, so the list has no button.
 */
export function ExamList({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("Exams");
  const locale = useLocale();
  const pagination = usePaginatedQuery(
    exams.exams.list,
    { slug },
    { initialNumItems: EXAM_PAGE_SIZE }
  );
  const { entry, ref } = useIntersection<HTMLDivElement>();
  const loadMore = PaginatedQueryResult.isCanLoadMore(pagination)
    ? pagination.loadMore
    : null;
  const atEnd = entry?.isIntersecting === true;

  useEffect(() => {
    if (atEnd && loadMore !== null) {
      loadMore(EXAM_PAGE_SIZE);
    }
  }, [atEnd, loadMore]);

  const names = useMemo(
    () => new Intl.DisplayNames([locale], { type: "language" }),
    [locale]
  );
  const empty =
    pagination._tag === "Exhausted" && pagination.results.length === 0;

  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="font-semibold text-xl">{t("title")}</h1>
      {empty ? (
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      ) : null}
      {pagination._tag === "LoadingFirstPage" ? null : (
        <ul className="flex flex-col gap-2">
          {Arr.map(pagination.results, (exam) => (
            <li key={exam.id}>
              <Button
                className="h-auto w-full justify-between py-2 text-start"
                render={<Link href={`/school/${slug}/exams/${exam.id}/edit`} />}
                variant="outline"
              >
                <span className="min-w-0 truncate font-medium">
                  {exam.title}
                </span>
                <span className="shrink-0 text-muted-foreground text-sm">
                  {names.of(exam.language)}
                </span>
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div aria-hidden ref={ref} />
    </main>
  );
}
