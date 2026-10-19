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
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr, Option } from "effect";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "zustand";
import { useConvexAuth } from "@/components/providers/convex";
import { LayoutContent } from "@/components/shared/content/layout";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty } from "@/components/shared/table/frame";
import { scopeChoices, unitLanguages } from "@/components/tenant/exams/create";
import { CreateExam } from "@/components/tenant/exams/dialog";
import { createExamDrafts } from "@/components/tenant/exams/drafts";
import type { ExamSummary } from "@/components/tenant/exams/optimistic";
import { SchoolHeader } from "@/components/tenant/header";

/** How many exams the list asks for each time its end comes into view. */
const EXAM_PAGE_SIZE = 20;

/** The columns of the exams table. */
const examColumns = createColumnHelper<typeof dataTableFeatures, ExamSummary>();

/**
 * The exams of the school, newest first, each with its title and its language. An exam that
 * the server has not saved yet is disabled until it answers. The next page loads when the end of
 * the list comes into view, so the list has no button. The create action sits in the school's
 * one header, and shows when the viewer can create an exam in at least one place.
 */
export function ExamList({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("Exams");
  const locale = useLocale();
  // Both reads need the session, which Convex learns a moment after the page draws.
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const pagination = usePaginatedQuery(
    exams.exams.list,
    isSettled ? { slug } : "skip",
    { initialNumItems: EXAM_PAGE_SIZE }
  );
  const viewer = useQuery(tenancy.viewer.get, isSettled ? { slug } : "skip");
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
      <LayoutContent className="flex w-full flex-col gap-6 py-6">
        {pagination._tag === "LoadingFirstPage" ? null : (
          <ExamTable exams={pagination.results} names={names} saving={saving} />
        )}
        <div aria-hidden ref={ref} />
      </LayoutContent>
    </>
  );
}

/**
 * The exams in a data table: the title links to its editor, and the language filters the
 * list by the languages the rows hold. With no exam, the table's empty state shows instead.
 */
function ExamTable({
  exams: rows,
  names,
  saving,
}: {
  exams: readonly ExamSummary[];
  names: Intl.DisplayNames;
  saving: readonly ExamSummary["id"][];
}) {
  const t = useTranslations("Exams");

  if (Arr.isReadonlyArrayEmpty(rows)) {
    return (
      <TableEmpty
        act="writing"
        description={t("create-description")}
        title={t("empty")}
      />
    );
  }

  /** The language of one exam by its name in the reader's language. */
  const languageLabel = (exam: ExamSummary) => names.of(exam.language);
  const languages = Arr.dedupe(
    Arr.getSomes(
      Arr.map(rows, (exam) => Option.fromNullishOr(languageLabel(exam)))
    )
  );
  const columns = examColumns.columns([
    examColumns.accessor((exam) => exam.title, {
      cell: (info) => (
        <span className="font-medium">
          {Arr.contains(saving, info.row.original.id) ? (
            <span className="text-muted-foreground">{info.getValue()}</span>
          ) : (
            <Link
              className="underline-offset-4 hover:underline"
              href={`/exams/${info.row.original.id}/edit`}
            >
              {info.getValue()}
            </Link>
          )}
        </span>
      ),
      filterFn: "includesString",
      header: t("title-label"),
      id: "title",
      sortFn: "text",
    }),
    examColumns.accessor(languageLabel, {
      cell: (info) => (
        <span className="text-muted-foreground">{info.getValue()}</span>
      ),
      filterFn: "oneOf",
      header: t("language"),
      id: "language",
      sortFn: "text",
    }),
  ]);

  return (
    <DataTable
      columns={columns}
      data={rows}
      facets={[
        {
          column: "language",
          options: Arr.map(languages, (label) => ({ label, value: label })),
          title: t("language"),
        },
      ]}
      rowId={(exam) => exam.id}
      search={{ column: "title", placeholder: t("exams-search") }}
    />
  );
}
