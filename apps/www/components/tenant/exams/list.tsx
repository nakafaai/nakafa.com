"use client";

import {
  PaginatedQueryResult,
  QueryResult,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import { File01Icon } from "@hugeicons/core-free-icons";
import { useIntersection } from "@mantine/hooks";
import exams from "@repo/backend/confect/_generated/refs/exams";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { Array as Arr } from "effect";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "zustand";
import { LayoutContent } from "@/components/shared/content/layout";
import { TableEmpty, TableFrame } from "@/components/shared/table/frame";
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
 * The exams in a data table, the title linking to its editor, or the table's empty
 * state when there is none.
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
        description={t("create-description")}
        icon={<HugeIcons icon={File01Icon} />}
        title={t("empty")}
      />
    );
  }

  return (
    <TableFrame>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("title-label")}</TableHead>
            <TableHead>{t("language")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Arr.map(rows, (exam) => (
            <ExamRow
              exam={exam}
              key={exam.id}
              names={names}
              saving={Arr.contains(saving, exam.id)}
            />
          ))}
        </TableBody>
      </Table>
    </TableFrame>
  );
}

/**
 * One exam of the table: its title, which opens its editor, and its language. An exam
 * that the server is still saving shows its title without a link, so it is inert.
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
  return (
    <TableRow>
      <TableCell className="font-medium">
        {saving ? (
          <span className="text-muted-foreground">{exam.title}</span>
        ) : (
          <Link
            className="underline-offset-4 hover:underline"
            href={`/exams/${exam.id}/edit`}
          >
            {exam.title}
          </Link>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {names.of(exam.language)}
      </TableCell>
    </TableRow>
  );
}
