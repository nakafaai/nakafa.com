import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import {
  CheckmarkCircle02Icon,
  Clock01Icon,
  HourglassIcon,
  SquareLock01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { StudentRow as StudentRowSchema } from "@repo/backend/confect/exams/results/contract";
import { AttemptState } from "@repo/backend/confect/exams/sittings/schema";
import { Button } from "@repo/design-system/components/ui/button";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { Array as Arr, DateTime, Option, Schema } from "effect";
import { useFormatter, useTranslations } from "use-intl";
import {
  useResultsPaper,
  useResultsScope,
  useSessionSettled,
} from "@/components/exams/results/context";
import { DataFailure } from "@/components/shared/failure";
import { usePanes } from "@/components/shared/panes";
import { reloadPage } from "@/components/shared/reload";
import { TableEmpty } from "@/components/shared/table/frame";
import { matchesSearch } from "@/components/shared/table/search";
import { type StatusLook, TableStatus } from "@/components/shared/table/status";
import { useTableFilters } from "@/components/shared/table/toolbar";
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

/**
 * The look of each attempt state, in its table cell and in the Filter menu: a running clock, the
 * sand of a closing sitting, a lock, and a check once submitted, each in its tone.
 */
const STATE_LOOKS = {
  closing: { icon: HourglassIcon, tone: "warning" },
  inProgress: { icon: Clock01Icon, tone: "info" },
  locked: { icon: SquareLock01Icon, tone: "danger" },
  submitted: { icon: CheckmarkCircle02Icon, tone: "success" },
} as const satisfies Record<
  (typeof StudentRowSchema.Type)["state"],
  StatusLook
>;

/** The status that the list shows: every attempt, or only the attempts in one state. */
const StatusFilter = Schema.Union([Schema.Literal("all"), AttemptState]);
export type StatusFilter = typeof StatusFilter.Type;

/** The seconds of one minute, which a long time away is told in. */
const SECONDS_IN_MINUTE = 60;

/**
 * How often a submitted student left the exam and for how long in all (K25), an indication for the
 * teacher only: empty before the attempt is submitted, and a zero when the student never left.
 */
function AwayCell({
  awaySeconds,
  exits,
}: {
  readonly awaySeconds: number | null;
  readonly exits: number | null;
}) {
  const t = useTranslations("Exams");
  if (exits === null || awaySeconds === null) {
    return <NotYet />;
  }
  if (exits === 0) {
    return "0";
  }
  if (awaySeconds < SECONDS_IN_MINUTE) {
    return t("results-away-seconds", { count: exits, seconds: awaySeconds });
  }
  return t("results-away-minutes", {
    count: exits,
    minutes: Math.floor(awaySeconds / SECONDS_IN_MINUTE),
    seconds: awaySeconds % SECONDS_IN_MINUTE,
  });
}

/** A value the attempt does not have yet, in muted words instead of a blank cell. */
function NotYet() {
  const t = useTranslations("Exams");
  return <span className="text-muted-foreground">{t("results-not-yet")}</span>;
}

/**
 * One student's row: the name, which opens the student's answers beside the list, the state, and the
 * scores of a submitted attempt, with the time it was submitted. Counts and scores sit to the right
 * in figures of one width, so the eye runs down each column, and a value not there yet says so.
 */
function StudentRow({ row }: { readonly row: typeof StudentRowSchema.Type }) {
  const t = useTranslations("Exams");
  const { timeZone, total } = useResultsPaper();
  const format = useFormatter();
  const chosen = usePanes((state) =>
    Option.exists(state.open, (open) => open === row.attemptId)
  );
  const show = usePanes((state) => state.show);
  const close = usePanes((state) => state.close);

  return (
    <TableRow data-state={chosen ? "selected" : undefined}>
      <TableCell>
        <Button
          aria-pressed={chosen}
          className="h-auto px-0"
          onClick={() => (chosen ? close() : show(row.attemptId))}
          type="button"
          variant="link"
        >
          {row.name}
        </Button>
      </TableCell>
      <TableCell>
        <TableStatus
          icon={STATE_LOOKS[row.state].icon}
          label={t(stateKeys[row.state])}
          tone={STATE_LOOKS[row.state].tone}
        />
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {row.points === null ? <NotYet /> : `${row.points} / ${total}`}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {row.answered ?? <NotYet />}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {row.pending ?? <NotYet />}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <AwayCell awaySeconds={row.awaySeconds} exits={row.exits} />
      </TableCell>
      <TableCell className="tabular-nums">
        {row.submittedAt === null ? (
          <NotYet />
        ) : (
          format.dateTime(
            DateTime.toDateUtc(DateTime.makeUnsafe(row.submittedAt)),
            {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone,
            }
          )
        )}
      </TableCell>
    </TableRow>
  );
}

/**
 * The values of the students' Filter menu, which the results page draws in its header row: every attempt, or
 * only the attempts in one state, which the server reads. Each value carries the icon of its state.
 */
export function useStatusChoices() {
  const t = useTranslations("Exams");

  return [
    { icon: UserGroupIcon, label: t("filter-all"), value: "all" as const },
    ...Arr.map(AttemptState.literals, (state) => ({
      icon: STATE_LOOKS[state].icon,
      label: t(stateKeys[state]),
      value: state,
    })),
  ];
}

/** The table of the given students, with its head and one row for each. */
function StudentTable({
  rows,
}: {
  readonly rows: readonly (typeof StudentRowSchema.Type)[];
}) {
  const t = useTranslations("Exams");

  return (
    <Table containerClassName="[&_[data-slot=table-cell]]:whitespace-nowrap">
      <TableHeader>
        <TableRow>
          <TableHead>{t("results-name")}</TableHead>
          <TableHead className="w-40">{t("results-status")}</TableHead>
          <TableHead className="w-28 text-right">
            {t("results-score")}
          </TableHead>
          <TableHead className="w-28 text-right">
            {t("results-answered")}
          </TableHead>
          <TableHead className="w-28 text-right">
            {t("results-pending")}
          </TableHead>
          <TableHead className="w-36 text-right">{t("results-away")}</TableHead>
          <TableHead className="w-44">{t("results-finished")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Arr.map(rows, (row) => (
          <StudentRow key={row.attemptId} row={row} />
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * The students of a sitting, one row each, with their score, answered and pending counts, and the time
 * they finished. A status filter reads only the attempts in that state, and a name search filters the rows
 * that are loaded. The list reads one page at a time through an intersection sentinel, not a button, so a
 * search that matches no loaded row keeps reading the next page until one matches or the list ends.
 */
export function StudentsTable({
  status,
}: {
  /** The state the header's Filter menu chose, which the server reads. */
  status: StatusFilter;
}) {
  const { sittingId, slug } = useResultsScope();
  const settled = useSessionSettled();
  const search = useTableFilters((state) => state.search);
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
  if (PaginatedQueryResult.isLoadingFirstPage(students)) {
    return null;
  }
  return (
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
  return (
    <>
      {failed ? <DataFailure onRetry={reloadPage} /> : null}
      {rows.length > 0 ? <StudentTable rows={rows} /> : null}
      {/* A page that holds no match is not the end of the search while later pages still load, so
          the empty state waits for the last page, and the table shows nothing in the meantime. */}
      {exhausted && rows.length === 0 ? (
        <TableEmpty
          act="reading"
          description={t(filtering ? "filter-empty" : "results-empty")}
          title={t(filtering ? "results-no-match" : "results-empty-title")}
        />
      ) : null}
      {loadMore === null ? null : <Intersection onIntersect={loadMore} />}
    </>
  );
}
