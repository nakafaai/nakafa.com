import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import {
  Archive02Icon,
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
  TaskEdit01Icon,
  TimeQuarterPassIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import {
  TaskStanding as Standing,
  standingOf,
} from "@repo/backend/confect/classroom/tasks/task";
import { Array as Arr, DateTime, Option, Result, Schema } from "effect";
import { useFormatter, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { PaneOpen } from "@/components/shared/pane";
import { Panes, PanesDetail, PanesList } from "@/components/shared/panes";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { chosenOne, namedOptions } from "@/components/shared/table/filter";
import { TableEmpty, TablePageBody } from "@/components/shared/table/frame";
import { TablePages } from "@/components/shared/table/pages";
import { TableTitle } from "@/components/shared/table/title";
import {
  TableFiltersProvider,
  TableSearch,
  useTableFilters,
} from "@/components/shared/table/toolbar";
import { ClassHeader } from "@/components/tenant/classes/header";
import { useClassScope } from "@/components/tenant/classes/scope";
import { NewTask } from "@/components/tenant/classes/tasks/create";
import { TaskDetail } from "@/components/tenant/classes/tasks/detail";
import { TaskRowMenu } from "@/components/tenant/classes/tasks/menu";
import type { ClassTask } from "@/components/tenant/classes/tasks/optimistic";
import { TaskStanding } from "@/components/tenant/classes/tasks/standing";
import { isLostAccess } from "@/components/tenant/refusal";
import { useClockZone } from "@/components/tenant/settings/time";
import { useKeptRows } from "@/lib/data/kept";

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

/** The shelf a teacher's list reads: the live tasks, or the archived ones. */
const TaskShelf = Schema.Literals(["live", "archived"]);

/** The standing that a student's list shows: every task, or only the tasks where the student's work stands so. */
const StandingFilter = Schema.Union([Schema.Literal("all"), Standing]);
type StandingFilter = typeof StandingFilter.Type;

/**
 * The tasks of a class: the class header with the search over the tasks' titles and New task for
 * its teachers, the tasks by deadline, the soonest first, in the page's one table card, and the
 * open task in the pane at the screen's right, with its work handed in for its teacher and the
 * hand-in for a student. A press on a row opens it, and the page's `PanesProvider` names the task
 * that a task's own address opens. A student's Status head chooses the tasks where the student's work stands so,
 * which the server reads, and the tasks already shown stay while a new standing's first page
 * loads. The next page loads when the end comes into view, and nothing stands in the card while
 * the first page loads. A class with no task shows the empty state without a search, a failed read
 * its sentence and Try again, and a viewer who lost the school's access is sent to the refused page.
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
  // A teacher's Shelf head reads the archived tasks in place of the live ones.
  const archived = Option.contains(
    chosenOne(chosen, "shelf", Schema.is(TaskShelf)),
    "archived"
  );
  const pagination = usePaginatedQuery(
    classroom.tasks.list,
    isSettled
      ? {
          classId,
          slug,
          ...(standing === "all" ? {} : { standing }),
          ...(archived ? { archived } : {}),
        }
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
  // A class with no task at all shows the empty state; a standing that holds no task keeps the table and its head.

  return (
    <>
      <ClassHeader>
        <TableSearch placeholder={t("tasks-search")} />
        {Arr.contains(can, "task.manage") ? <NewTask /> : null}
      </ClassHeader>
      {/* The header's 4rem and the tabs' 3rem stand above the list and its pane. */}
      <div className="flex min-h-0 flex-1 flex-col [--panes-offset:7rem]">
        <Panes id="tasks">
          <PanesList>
            <TablePageBody>
              <TablePages pageSize={TASK_PAGE_SIZE} pagination={pagination}>
                <DataTable
                  columns={columns}
                  data={Option.getOrElse(kept, Arr.empty)}
                  empty={
                    standing === "all" && !archived ? (
                      <TableEmpty
                        act="writing"
                        description={t("tasks-empty-description")}
                        title={t("tasks-empty")}
                      />
                    ) : undefined
                  }
                  rowId={(task) => task.slug}
                  search="title"
                />
              </TablePages>
            </TablePageBody>
          </PanesList>
          <PanesDetail label={t("task-detail")}>
            <TaskDetail rows={Option.getOrElse(kept, Arr.empty)} />
          </PanesDetail>
        </Panes>
      </div>
    </>
  );
}

/**
 * The columns of the task table: each task's title, which opens it, the category it is filed under, its deadline, where it
 * stands, the viewer's own work for a student and the number of work handed in for a teacher, and what the row can do.
 */
function useTaskColumns(categories: readonly string[]) {
  const t = useTranslations("Classroom");
  const timeZone = useClockZone();
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
            { dateStyle: "medium", timeStyle: "short", timeZone }
          )}
        </span>
      ),
      header: t("task-deadline"),
      id: "deadline",
      timeZone: () => timeZone,
    }),
    Arr.contains(can, "task.submit")
      ? // A student's standing, which the server filters by; the same rule keeps the rows the table shows.
        taskColumns.choice((task) => standingOf(task.mine), {
          cell: (info) => (
            <span className="text-muted-foreground">
              <TaskStanding task={info.row.original} />
            </span>
          ),
          header: t("task-status"),
          id: "standing",
          options: standingChoices,
        })
      : taskColumns.number((task) => task.handedIn, {
          cell: (info) => (
            <span className="text-muted-foreground">
              <TaskStanding task={info.row.original} />
            </span>
          ),
          header: t("task-status"),
          id: "handedIn",
        }),
    ...(Arr.contains(can, "task.manage")
      ? [
          // A teacher's shelf, which the server filters by: the live tasks, or the archived ones.
          taskColumns.choice((task) => (task.archived ? "archived" : "live"), {
            cell: (info) => (
              <span className="text-muted-foreground">
                {t(info.row.original.archived ? "task-archived" : "task-live")}
              </span>
            ),
            header: t("task-shelf"),
            id: "shelf",
            options: [
              {
                icon: Task01Icon,
                label: t("task-live"),
                value: "live" as const,
              },
              {
                icon: Archive02Icon,
                label: t("task-archived"),
                value: "archived" as const,
              },
            ],
          }),
        ]
      : []),
    taskColumns.menu((info) => <TaskRowMenu task={info.row.original} />),
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

/** A task's title, which opens the task in the pane. */
function TaskTitle({ task }: { task: ClassTask }) {
  return (
    <TableTitle icon={TaskEdit01Icon}>
      <PaneOpen id={task.slug}>{task.title}</PaneOpen>
    </TableTitle>
  );
}
