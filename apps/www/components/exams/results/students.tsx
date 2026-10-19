"use client";

import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { StudentRow as StudentRowSchema } from "@repo/backend/confect/exams/results/contract";
import { AttemptState } from "@repo/backend/confect/exams/sittings/schema";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { Array as Arr, DateTime, Schema } from "effect";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import {
  useResultsPaper,
  useResultsScope,
  useSessionSettled,
} from "@/components/exams/results/context";
import { TableSearch, TableToggle } from "@/components/exams/results/filter";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { TableEmpty, TableFrame } from "@/components/shared/table/frame";
import { matchesSearch } from "@/components/shared/table/search";
import { isLostAccess } from "@/components/tenant/refusal";

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

/** The status that the list shows: every attempt, or only the attempts in one state. */
const StatusFilter = Schema.Union([Schema.Literal("all"), AttemptState]);
type StatusFilter = typeof StatusFilter.Type;

/** One student's row: the name, the state, and the scores of a submitted attempt, with the time it was submitted. */
function StudentRow({ row }: { readonly row: typeof StudentRowSchema.Type }) {
  const t = useTranslations("Exams");
  const { timeZone, total } = useResultsPaper();
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

/** The filters of the students' list: the state of the attempt, and the name that the rows must hold. */
function StudentFilters({
  onSearch,
  onStatus,
  search,
  status,
}: {
  readonly onSearch: (search: string) => void;
  readonly onStatus: (status: StatusFilter) => void;
  readonly search: string;
  readonly status: StatusFilter;
}) {
  const t = useTranslations("Exams");

  return (
    <div className="flex flex-wrap items-center gap-3">
      <TableToggle
        choices={[
          { label: t("filter-all"), value: "all" },
          { label: t(stateKeys.inProgress), value: "inProgress" },
          { label: t(stateKeys.closing), value: "closing" },
          { label: t(stateKeys.locked), value: "locked" },
          { label: t(stateKeys.submitted), value: "submitted" },
        ]}
        label={t("filter-label")}
        onChange={(next) => {
          if (Schema.is(StatusFilter)(next)) {
            onStatus(next);
          }
        }}
        value={status}
      />
      <TableSearch
        label={t("results-search")}
        onChange={onSearch}
        placeholder={t("results-search")}
        value={search}
      />
    </div>
  );
}

/** The table of the given students, with its head and one row for each. */
function StudentTable({
  rows,
}: {
  readonly rows: readonly (typeof StudentRowSchema.Type)[];
}) {
  const t = useTranslations("Exams");

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
          {Arr.map(rows, (row) => (
            <StudentRow key={row.attemptId} row={row} />
          ))}
        </TableBody>
      </Table>
    </TableFrame>
  );
}

/**
 * The students of a sitting, one row each, with their score, answered and pending counts, and the time
 * they finished. A status filter reads only the attempts in that state, and a name search filters the rows
 * that are loaded. The list reads one page at a time through an intersection sentinel, not a button, so a
 * search that matches no loaded row keeps reading the next page until one matches or the list ends.
 */
export function StudentsTable() {
  const { sittingId, slug } = useResultsScope();
  const settled = useSessionSettled();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const scope =
    status === "all" ? { sittingId, slug } : { sittingId, slug, state: status };
  const students = usePaginatedQuery(
    exams.results.results.byStudent,
    settled ? scope : "skip",
    { initialNumItems: STUDENT_PAGE_SIZE }
  );

  if (
    PaginatedQueryResult.isFailure(students) &&
    isLostAccess(students.error)
  ) {
    throw students.error;
  }
  const filters = (
    <StudentFilters
      onSearch={setSearch}
      onStatus={setStatus}
      search={search}
      status={status}
    />
  );
  if (PaginatedQueryResult.isLoadingFirstPage(students)) {
    return status !== "all" || search.trim() !== "" ? filters : null;
  }
  return (
    <>
      {filters}
      <StudentRowsSection
        exhausted={PaginatedQueryResult.isExhausted(students)}
        failed={PaginatedQueryResult.isFailure(students)}
        filtering={status !== "all" || search.trim() !== ""}
        loadMore={
          PaginatedQueryResult.isCanLoadMore(students)
            ? () => students.loadMore(STUDENT_PAGE_SIZE)
            : null
        }
        rows={students.results}
        search={search}
      />
    </>
  );
}

/**
 * The rows of the students' table below its filters: the failure of its read above the rows it holds,
 * the rows that match the search, and the empty state once the list is exhausted with no match, or
 * with no student at all. A list that still loads, or that failed, shows no empty state.
 */
function StudentRowsSection({
  exhausted,
  failed,
  filtering,
  loadMore,
  rows: students,
  search,
}: {
  /** Whether the list has no more pages, so an empty table is the end of the list and not a wait. */
  exhausted: boolean;
  failed: boolean;
  filtering: boolean;
  /** Loads the next page of students, or none when the list has no more pages. */
  loadMore: (() => void) | null;
  rows: readonly (typeof StudentRowSchema.Type)[];
  search: string;
}) {
  const t = useTranslations("Exams");
  const rows = Arr.filter(students, (row) => matchesSearch(row.name, search));
  // A page that holds no match is not the end of the search while later pages still load, so
  // the empty state waits for the last page, and the table shows nothing in the meantime.
  const more =
    loadMore === null ? null : <Intersection onIntersect={loadMore} />;
  const empty = filtering ? (
    <TableEmpty
      act="reading"
      description={t("filter-empty")}
      title={t("results-no-match")}
    />
  ) : (
    <TableEmpty
      act="reading"
      description={t("results-empty")}
      title={t("results-empty-title")}
    />
  );
  return (
    <>
      {failed ? <DataFailure onRetry={reloadPage} /> : null}
      {rows.length > 0 ? <StudentTable rows={rows} /> : null}
      {exhausted && rows.length === 0 ? empty : null}
      {more}
    </>
  );
}
