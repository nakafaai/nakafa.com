"use client";

import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { StudentRow as StudentRowSchema } from "@repo/backend/confect/exams/results/contract";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { Array as Arr, DateTime } from "effect";
import { useFormatter, useTranslations } from "next-intl";
import {
  useResultsScope,
  useSessionSettled,
} from "@/components/exams/results/context";
import { TableEmpty, TableFrame } from "@/components/shared/table/frame";

/** The students of one page of the list. The next page loads as the list's end comes into view. */
const STUDENT_PAGE_SIZE = 50;

/** The copy key of each state of an attempt. */
const stateKeys = {
  closing: "state-closing",
  inProgress: "state-in-progress",
  locked: "state-locked",
  submitted: "state-submitted",
} satisfies Record<
  (typeof StudentRowSchema.Type)["state"],
  "state-closing" | "state-in-progress" | "state-locked" | "state-submitted"
>;

/** One student's row: the name, the state, and the scores of a submitted attempt, with the time it was submitted. */
function StudentRow({
  row,
  timeZone,
  total,
}: {
  readonly row: typeof StudentRowSchema.Type;
  readonly timeZone: string;
  readonly total: number;
}) {
  const t = useTranslations("Exams");
  const format = useFormatter();

  return (
    <TableRow>
      <TableCell>{row.name}</TableCell>
      <TableCell>{t(stateKeys[row.state])}</TableCell>
      <TableCell className="tabular-nums">
        {row.points === null ? "" : `${row.points} / ${total}`}
      </TableCell>
      <TableCell className="tabular-nums">{row.answered ?? ""}</TableCell>
      <TableCell className="tabular-nums">{row.pending ?? ""}</TableCell>
      <TableCell className="tabular-nums">
        {row.submittedAt === null
          ? ""
          : format.dateTime(
              DateTime.toDateUtc(DateTime.makeUnsafe(row.submittedAt)),
              {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone,
              }
            )}
      </TableCell>
    </TableRow>
  );
}

/**
 * The students of a sitting, one row each, with their score, answered and pending counts, and the time
 * they finished. The list reads one page at a time through an intersection sentinel, not a button.
 */
export function StudentsTable({
  timeZone,
  total,
}: {
  readonly timeZone: string;
  readonly total: number;
}) {
  const t = useTranslations("Exams");
  const { sittingId, slug } = useResultsScope();
  const settled = useSessionSettled();
  const students = usePaginatedQuery(
    exams.results.results.byStudent,
    settled ? { sittingId, slug } : "skip",
    { initialNumItems: STUDENT_PAGE_SIZE }
  );

  if (PaginatedQueryResult.isFailure(students)) {
    throw students.error;
  }
  if (PaginatedQueryResult.isLoadingFirstPage(students)) {
    return null;
  }
  if (students.results.length === 0) {
    return (
      <TableEmpty
        act="reading"
        description={t("results-empty")}
        title={t("results-empty-title")}
      />
    );
  }
  return (
    <TableFrame>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("results-name")}</TableHead>
            <TableHead>{t("results-status")}</TableHead>
            <TableHead>{t("results-score")}</TableHead>
            <TableHead>{t("results-answered")}</TableHead>
            <TableHead>{t("results-pending")}</TableHead>
            <TableHead>{t("results-finished")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Arr.map(students.results, (row) => (
            <StudentRow
              key={row.attemptId}
              row={row}
              timeZone={timeZone}
              total={total}
            />
          ))}
        </TableBody>
      </Table>
      {PaginatedQueryResult.isCanLoadMore(students) ? (
        <Intersection
          onIntersect={() => students.loadMore(STUDENT_PAGE_SIZE)}
        />
      ) : null}
    </TableFrame>
  );
}
