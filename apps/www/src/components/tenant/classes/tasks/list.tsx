import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import {
  Award02Icon,
  Book02Icon,
  Bookmark01Icon,
  Calendar03Icon,
  Flag01Icon,
  Folder01Icon,
  Note01Icon,
  Tag01Icon,
  Task01Icon,
  TaskDone01Icon,
  TimeQuarterPassIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import {
  TaskStanding as Standing,
  standingOf,
} from "@repo/backend/confect/classroom/tasks/task";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { Array as Arr, DateTime, Option, Result, Schema } from "effect";
import { useFormatter, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { useFormatTimeZone } from "@/components/shared/table/calendar";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { chosenOne, namedOptions } from "@/components/shared/table/filter";
import { TableEmpty, TablePageBody } from "@/components/shared/table/frame";
import {
  TableFiltersProvider,
  TableSearch,
  useTableFilters,
} from "@/components/shared/table/toolbar";
import { ClassHeader } from "@/components/tenant/classes/header";
import { useClassScope } from "@/components/tenant/classes/scope";
import { NewTask } from "@/components/tenant/classes/tasks/create";
import type { ClassTask } from "@/components/tenant/classes/tasks/optimistic";
import { isLostAccess } from "@/components/tenant/refusal";
import { useKeptRows } from "@/lib/data/kept";
import { TargetLink } from "@/lib/routing/link";
import { schoolClassTaskTarget } from "@/lib/routing/school/target";

/** How many tasks the list reads each time its end comes into view. */
const TASK_PAGE_SIZE = 20;

/** The columns of the task table. */
const taskColumns = tableColumns<ClassTask>();

/** The icons of the categories in the category filter, each a kind of file or mark. */
const CATEGORY_ICONS: readonly [IconSvgElement, ...IconSvgElement[]] = [
  Tag01Icon,
  Bookmark01Icon,
  Folder01Icon,
  Flag01Icon,
  Note01Icon,
  Book02Icon,
] as const;

/**
 * The look of each standing of a task in its column's filter: a task still open, work handed in, work that came
 * late, and work that has its points.
 */
const STANDING_ICONS = {
  handedIn: TaskDone01Icon,
  late: TimeQuarterPassIcon,
  open: Task01Icon,
  scored: Award02Icon,
} as const satisfies Record<typeof Standing.Type, IconSvgElement>;

/** The standing that a student's list shows: every task, or only the tasks where the student's work stands so. */
const StandingFilter = Schema.Union([Schema.Literal("all"), Standing]);
type StandingFilter = typeof StandingFilter.Type;

/**
 * The tasks of a class: the class header with the search over the tasks' titles and New task for
 * its teachers, and the tasks by deadline, the soonest first, in the page's one table card. A
 * student's Status head chooses the tasks where the student's work stands so, which the server
 * reads, and the tasks already shown stay while a new standing's first page loads. The next page
 * loads when the end comes into view, and nothing stands in the card while the first page loads. A
 * class with no task shows the empty state without a search, a failed read its sentence and Try
 * again, and a viewer who lost the school's access is sent to the refused page.
 */
export function TaskList() {
  return (
    <TableFiltersProvider>
      <TaskListBody />
    </TableFiltersProvider>
  );
}

/** The header and the table of the class's tasks, which read the standing the page's filters chose. */
function TaskListBody() {
  const t = useTranslations("Classroom");
  const { can, classId, slug } = useClassScope();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const chosen = useTableFilters((state) => state.chosen);
  const standing = Option.getOrElse(
    chosenOne(chosen, "standing", Schema.is(StandingFilter)),
    (): StandingFilter => "all"
  );
  const pagination = usePaginatedQuery(
    classroom.tasks.list,
    isSettled
      ? { classId, slug, ...(standing === "all" ? {} : { standing }) }
      : "skip",
    { initialNumItems: TASK_PAGE_SIZE }
  );
  const kept = useKeptRows(
    PaginatedQueryResult.isLoadingFirstPage(pagination),
    pagination.results
  );
  const columns = useTaskColumns(
    Arr.dedupe(
      Arr.filterMap(pagination.results, (task) =>
        task.category === null ? Result.failVoid : Result.succeed(task.category)
      )
    )
  );
  if (
    PaginatedQueryResult.isFailure(pagination) &&
    isLostAccess(pagination.error)
  ) {
    throw pagination.error;
  }
  const failed = PaginatedQueryResult.isFailure(pagination);
  // A class with no task at all shows the empty state; a standing that holds no task keeps the table and its head.
  const empty =
    !failed &&
    standing === "all" &&
    Option.exists(kept, Arr.isReadonlyArrayEmpty);

  return (
    <>
      <ClassHeader>
        {empty ? null : <TableSearch placeholder={t("tasks-search")} />}
        {Arr.contains(can, "task.manage") ? <NewTask /> : null}
      </ClassHeader>
      <TablePageBody>
        {empty ? (
          <TableEmpty
            act="writing"
            description={t("tasks-empty-description")}
            title={t("tasks-empty")}
          />
        ) : null}
        {failed ? <DataFailure onRetry={reloadPage} /> : null}
        {failed || empty || Option.isNone(kept) ? null : (
          <DataTable
            columns={columns}
            data={kept.value}
            rowId={(task) => task.id}
            search="title"
          />
        )}
        {PaginatedQueryResult.isCanLoadMore(pagination) ? (
          <Intersection
            onIntersect={() => pagination.loadMore(TASK_PAGE_SIZE)}
          />
        ) : null}
      </TablePageBody>
    </>
  );
}

/**
 * The columns of the task table: each task's title, which opens it, the category it is filed under, its deadline, and where it
 * stands, the viewer's own work for a student and the number of work handed in for a teacher.
 */
function useTaskColumns(categories: readonly string[]) {
  const t = useTranslations("Classroom");
  const formatZone = useFormatTimeZone();
  const format = useFormatter();
  const { can } = useClassScope();
  const standingChoices = useStandingChoices();

  return [
    taskColumns.text((task) => task.title, {
      cell: (info) => <TaskTitle task={info.row.original} />,
      header: t("task-title"),
      id: "title",
    }),
    taskColumns.values((task) => task.category ?? "", {
      cell: (info) => (
        <span className="text-muted-foreground" dir="auto">
          {info.getValue()}
        </span>
      ),
      header: t("task-category"),
      id: "category",
      options: namedOptions(categories, CATEGORY_ICONS),
    }),
    taskColumns.days((task) => task.deadline, {
      cell: (info) => (
        <span className="text-muted-foreground tabular-nums">
          {format.dateTime(
            DateTime.toDateUtc(DateTime.makeUnsafe(info.getValue())),
            { dateStyle: "medium", timeStyle: "short" }
          )}
        </span>
      ),
      header: t("task-deadline"),
      id: "deadline",
      timeZone: formatZone,
    }),
    Arr.contains(can, "task.manage")
      ? taskColumns.number((task) => task.handedIn, {
          cell: (info) => (
            <span className="text-muted-foreground">
              <TaskStanding task={info.row.original} />
            </span>
          ),
          header: t("task-status"),
          id: "handedIn",
        })
      : // A student's standing, which the server filters by; the same rule keeps the rows the table shows.
        taskColumns.choice((task) => standingOf(task.mine), {
          cell: (info) => (
            <span className="text-muted-foreground">
              <TaskStanding task={info.row.original} />
            </span>
          ),
          header: t("task-status"),
          id: "standing",
          options: standingChoices,
        }),
  ];
}

/**
 * The values of a student's Status head, which chooses the tasks the server reads: every task, or only the tasks
 * where the student's work stands so. Each value carries the icon of its standing.
 */
function useStandingChoices() {
  const t = useTranslations("Classroom");
  const labels = {
    handedIn: t("task-handed-in"),
    late: t("task-handed-in-late"),
    open: t("task-not-handed-in"),
    scored: t("task-standing-scored"),
  } satisfies Record<typeof Standing.Type, string>;

  return [
    {
      icon: Calendar03Icon,
      label: t("tasks-filter-all"),
      value: "all" as const,
    },
    ...Arr.map(Standing.literals, (value) => ({
      icon: STANDING_ICONS[value],
      label: labels[value],
      value,
    })),
  ];
}

/** A task's title, which opens the task. */
function TaskTitle({ task }: { task: ClassTask }) {
  const { classSlug, slug } = useClassScope();

  return (
    <TargetLink
      className="font-medium underline-offset-4 hover:underline"
      dir="auto"
      target={schoolClassTaskTarget(slug, classSlug, task.slug)}
    >
      {task.title}
    </TargetLink>
  );
}

/** Where a task stands: how many handed work in, for a teacher who keeps the class's tasks, or the viewer's own work. */
export function TaskStanding({ task }: { task: ClassTask }) {
  const t = useTranslations("Classroom");
  const { can } = useClassScope();
  if (Arr.contains(can, "task.manage")) {
    return t("task-handed-in-count", { count: task.handedIn });
  }
  if (task.mine !== null && task.mine.score !== null) {
    return t("task-scored", { points: task.points, score: task.mine.score });
  }
  const standing = standingOf(task.mine);
  if (standing === "open") {
    return t("task-not-handed-in");
  }
  return standing === "late" ? t("task-handed-in-late") : t("task-handed-in");
}
