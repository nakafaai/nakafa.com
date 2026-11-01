import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import {
  CheckmarkCircle02Icon,
  Clock01Icon,
  HourglassIcon,
  MoreHorizontalIcon,
  SquareLock01Icon,
  UserGroupIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import exams from "@repo/backend/confect/_generated/refs/exams";
import type { StudentRow as StudentRowSchema } from "@repo/backend/confect/exams/results/contract";
import { AttemptState } from "@repo/backend/confect/exams/sittings/schema";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
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
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { chosenOne } from "@/components/shared/table/filter";
import { TableEmpty } from "@/components/shared/table/frame";
import { type StatusLook, TableStatus } from "@/components/shared/table/status";
import {
  useServerSearch,
  useTableFilters,
} from "@/components/shared/table/toolbar";
import { isLostAccess } from "@/components/tenant/refusal";
import { useKeptRows } from "@/lib/data/kept";

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
 * The look of each attempt state, in its table cell and in its column's filter: a running clock, the
 * sand of a closing sitting, a lock, and a check once submitted, each in its tone.
 */
const STATE_LOOKS = {
  closing: { icon: HourglassIcon, tone: "warning" },
  inProgress: { icon: Clock01Icon, tone: "info" },
  locked: { icon: SquareLock01Icon, tone: "destructive" },
  submitted: { icon: CheckmarkCircle02Icon, tone: "success" },
} as const satisfies Record<
  (typeof StudentRowSchema.Type)["state"],
  StatusLook
>;

/** The status that the list shows: every attempt, or only the attempts in one state. */
const StatusFilter = Schema.Union([Schema.Literal("all"), AttemptState]);
type StatusFilter = typeof StatusFilter.Type;

/** The seconds of one minute, which a long time away is told in. */
const SECONDS_IN_MINUTE = 60;

/**
 * How often a submitted student left the exam and for how long in all (K25), an indication for the
 * teacher only: empty before the attempt is submitted, and a zero when the student never left.
 */
export function AwayCell({
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
 * One student's row, which opens the student's answers beside the list when pressed, as the name does for a
 * keyboard: the name, the state, and the scores of a submitted attempt, with the time it was submitted. Counts and
 * scores stand in the middle in figures of one width, so the eye runs down each column, and a value not there yet
 * says so.
 */
function StudentName({ row }: { readonly row: typeof StudentRowSchema.Type }) {
  const chosen = usePanes((state) =>
    Option.exists(state.open, (open) => open === row.attemptId)
  );
  const show = usePanes((state) => state.show);
  const close = usePanes((state) => state.close);

  return (
    <Button
      aria-pressed={chosen}
      className="h-auto px-0"
      onClick={() => (chosen ? close() : show(row.attemptId))}
      type="button"
      variant="link"
    >
      {row.name}
    </Button>
  );
}

/** The row menu of one student: Answers, which opens the student's answers beside the list. */
function StudentRowMenu({
  attemptId,
}: {
  readonly attemptId: (typeof StudentRowSchema.Type)["attemptId"];
}) {
  const t = useTranslations("Exams");
  const common = useTranslations("Common");
  const show = usePanes((state) => state.show);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={common("more-actions")}
            size="icon-sm"
            variant="ghost"
          >
            <HugeIcons icon={MoreHorizontalIcon} />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => show(attemptId)}>
            <HugeIcons icon={ViewIcon} />
            {t("results-answers")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The columns of the students' table. */
const studentColumns = tableColumns<typeof StudentRowSchema.Type>();

/**
 * The values of the students' status column, which chooses the attempts the server reads: every attempt, or only the
 * attempts in one state. Each value carries the icon of its state.
 */
function useStatusChoices() {
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

/** The columns of the students' table: each student's state, score, counts and the time they finished. */
function useStudentColumns() {
  const t = useTranslations("Exams");
  const { timeZone, total } = useResultsPaper();
  const format = useFormatter();
  const statusChoices = useStatusChoices();

  return [
    studentColumns.text((row) => row.name, {
      cell: (info) => <StudentName row={info.row.original} />,
      header: t("results-name"),
      id: "name",
    }),
    studentColumns.choice((row) => row.state, {
      cell: (info) => (
        <TableStatus
          icon={STATE_LOOKS[info.getValue()].icon}
          label={t(stateKeys[info.getValue()])}
          tone={STATE_LOOKS[info.getValue()].tone}
        />
      ),
      header: t("results-status"),
      id: "status",
      options: statusChoices,
    }),
    studentColumns.number((row) => row.points, {
      cell: (info) => {
        const points = info.getValue();
        return points === null ? <NotYet /> : `${points} / ${total}`;
      },
      header: t("results-score"),
      id: "score",
    }),
    studentColumns.number((row) => row.answered, {
      cell: (info) => info.getValue() ?? <NotYet />,
      header: t("results-answered"),
      id: "answered",
    }),
    studentColumns.number((row) => row.pending, {
      cell: (info) => info.getValue() ?? <NotYet />,
      header: t("results-pending"),
      id: "pending",
    }),
    studentColumns.number((row) => row.awaySeconds, {
      cell: (info) => (
        <AwayCell
          awaySeconds={info.getValue()}
          exits={info.row.original.exits}
        />
      ),
      header: t("results-away"),
      id: "away",
    }),
    studentColumns.days((row) => row.submittedAt, {
      cell: (info) => {
        const at = info.getValue();
        return at === null ? (
          <NotYet />
        ) : (
          format.dateTime(DateTime.toDateUtc(DateTime.makeUnsafe(at)), {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone,
          })
        );
      },
      header: t("results-finished"),
      id: "finished",
      timeZone: () => timeZone,
    }),
    studentColumns.menu((info) => (
      <StudentRowMenu attemptId={info.row.original.attemptId} />
    )),
  ];
}

/**
 * The students of a sitting, one row each, with their score, answered and pending counts, and the time
 * they finished. The server reads the filters: a status reads only the attempts in that state, and a name
 * search reads the students whose names match it, best match first. The list reads one page at a time
 * through an intersection sentinel, not a button, so a page of a search that holds no match keeps reading
 * the next page until one matches or the list ends.
 */
export function StudentsTable() {
  const { sittingId, slug } = useResultsScope();
  const settled = useSessionSettled();
  const search = useServerSearch();
  const chosen = useTableFilters((state) => state.chosen);
  const status = Option.getOrElse(
    chosenOne(chosen, "status", Schema.is(StatusFilter)),
    (): StatusFilter => "all"
  );
  const scope = {
    sittingId,
    slug,
    ...(status === "all" ? {} : { state: status }),
    ...(search === "" ? {} : { search }),
  };
  const students = usePaginatedQuery(
    exams.results.results.byStudent,
    settled ? scope : "skip",
    { initialNumItems: STUDENT_PAGE_SIZE }
  );
  // A new status's or search's first page loads behind the rows the table already shows, so the table never blanks.
  const kept = useKeptRows(
    PaginatedQueryResult.isLoadingFirstPage(students),
    students.results
  );

  if (
    PaginatedQueryResult.isFailure(students) &&
    isLostAccess(students.error)
  ) {
    throw students.error;
  }
  if (Option.isNone(kept)) {
    return null;
  }
  return (
    <StudentRowsSection
      exhausted={PaginatedQueryResult.isExhausted(students)}
      failed={PaginatedQueryResult.isFailure(students)}
      filtering={status !== "all" || search !== ""}
      loadMore={
        PaginatedQueryResult.isCanLoadMore(students)
          ? () => students.loadMore(STUDENT_PAGE_SIZE)
          : null
      }
      rows={kept.value}
    />
  );
}

/**
 * The rows of the students' table below its filters: the failure of its read above the rows it holds,
 * the rows the server read for the filters, and the empty state once the list is exhausted with no
 * match, or with no student at all. A list that still loads, or that failed, shows no empty state.
 */
function StudentRowsSection({
  exhausted,
  failed,
  filtering,
  loadMore,
  rows,
}: {
  /** Whether the list has no more pages, so an empty table is the end of the list and not a wait. */
  exhausted: boolean;
  failed: boolean;
  filtering: boolean;
  /** Loads the next page of students, or none when the list has no more pages. */
  loadMore: (() => void) | null;
  rows: readonly (typeof StudentRowSchema.Type)[];
}) {
  const t = useTranslations("Exams");
  const columns = useStudentColumns();

  return (
    <>
      {failed ? <DataFailure onRetry={reloadPage} /> : null}
      {/* While a filter or a search narrows the list, the table keeps its head, so the status choice stays in reach. */}
      {rows.length > 0 || filtering ? (
        <DataTable
          columns={columns}
          data={rows}
          loading={loadMore !== null || rows.length === 0}
          rowId={(row) => row.attemptId}
        />
      ) : null}
      {/* A page of a search can hold no match while later pages still load, so the empty state
          waits for the last page, and the table shows nothing in the meantime. */}
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
