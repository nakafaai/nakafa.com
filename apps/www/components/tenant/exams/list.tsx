"use client";

import {
  PaginatedQueryResult,
  QueryResult,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import { useIntersection } from "@mantine/hooks";
import exams from "@repo/backend/confect/_generated/refs/exams";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import { Array as Arr } from "effect";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "zustand";
import { LayoutContent } from "@/components/shared/content/layout";
import { scopeChoices, unitLanguages } from "@/components/tenant/exams/create";
import { CreateExam } from "@/components/tenant/exams/dialog";
import { createExamDrafts } from "@/components/tenant/exams/drafts";
import type { ExamSummary } from "@/components/tenant/exams/optimistic";
import { SchoolHeader } from "@/components/tenant/header";

/** How many exams the list asks for each time its end comes into view. */
const EXAM_PAGE_SIZE = 20;

/**
 * The exams of the school, newest first, each with its title and its language. An exam that
 * the server has not saved yet is disabled until it answers. The next page loads when the end of
 * the list comes into view, so the list has no button. The create action sits in the school's
 * one header, and shows when the viewer can create an exam in at least one place.
 */
export function ExamList({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("Exams");
  const locale = useLocale();
  const pagination = usePaginatedQuery(
    exams.exams.list,
    { slug },
    { initialNumItems: EXAM_PAGE_SIZE }
  );
  const viewer = useQuery(tenancy.viewer.get, { slug });
  const [drafts] = useState(createExamDrafts);
  const saving = useStore(drafts, (state) => state.ids);
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
  const choices = QueryResult.isSuccess(viewer)
    ? scopeChoices(
        viewer.value.units,
        Arr.contains(viewer.value.can, "exam.edit")
      )
    : [];
  const languages = QueryResult.isSuccess(viewer)
    ? unitLanguages(viewer.value.units)
    : [];
  const empty =
    pagination._tag === "Exhausted" && pagination.results.length === 0;

  return (
    <>
      <SchoolHeader items={[{ label: t("title") }]} title={t("title")}>
        {choices.length > 0 ? (
          <CreateExam
            choices={choices}
            drafts={drafts}
            languages={languages}
            slug={slug}
          />
        ) : null}
      </SchoolHeader>
      <LayoutContent className="flex w-full flex-col gap-2 py-6">
        {empty ? (
          <p className="text-muted-foreground text-sm">{t("empty")}</p>
        ) : null}
        {pagination._tag === "LoadingFirstPage" ? null : (
          <ul className="flex flex-col gap-2">
            {Arr.map(pagination.results, (exam) => (
              <li key={exam.id}>
                <ExamRow
                  exam={exam}
                  names={names}
                  saving={Arr.contains(saving, exam.id)}
                />
              </li>
            ))}
          </ul>
        )}
        <div aria-hidden ref={ref} />
      </LayoutContent>
    </>
  );
}

/**
 * One exam of the list: its title and its language. A saved exam links to its editor. An
 * exam that the server is still saving shows the same row without a link, so it is disabled.
 */
function ExamRow({
  exam,
  names,
  saving,
}: {
  exam: ExamSummary;
  names: Intl.DisplayNames;
  saving: boolean;
}) {
  const content = (
    <>
      <span className="min-w-0 truncate font-medium">{exam.title}</span>
      <span className="shrink-0 text-muted-foreground text-sm">
        {names.of(exam.language)}
      </span>
    </>
  );

  if (saving) {
    return (
      <Button
        className="h-auto w-full justify-between py-2 text-start"
        disabled
        variant="outline"
      >
        {content}
      </Button>
    );
  }

  return (
    <Button
      className="h-auto w-full justify-between py-2 text-start"
      render={<Link href={`/exams/${exam.id}/edit`} />}
      variant="outline"
    >
      {content}
    </Button>
  );
}
