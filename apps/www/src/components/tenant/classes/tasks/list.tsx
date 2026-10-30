import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr, DateTime } from "effect";
import { useFormatter, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty, TablePageBody } from "@/components/shared/table/frame";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { ClassHeader } from "@/components/tenant/classes/header";
import { useClassScope } from "@/components/tenant/classes/scope";
import { NewTask } from "@/components/tenant/classes/tasks/create";
import type { ClassTask } from "@/components/tenant/classes/tasks/optimistic";
import { isLostAccess } from "@/components/tenant/refusal";
import { TargetLink } from "@/lib/routing/link";
import { schoolClassTaskTarget } from "@/lib/routing/school/target";

/** How many tasks the list reads each time its end comes into view. */
const TASK_PAGE_SIZE = 20;

/** The columns of the task table. */
const taskColumns = createColumnHelper<typeof dataTableFeatures, ClassTask>();

/**
 * The tasks of a class: the class header with the search over the tasks' titles and New task for
 * its teachers, and the tasks by deadline, the soonest first, in the page's one table card. The
 * next page loads when the end comes into view, and nothing stands in the card while the first page
 * loads. A class with no task shows the empty state without a search, a failed read its sentence
 * and Try again, and a viewer who lost the school's access is sent to the refused page.
 */
export function TaskList() {
  const t = useTranslations("Classroom");
  const { can, classId, slug } = useClassScope();
  const columns = useTaskColumns();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const pagination = usePaginatedQuery(
    classroom.tasks.list,
    isSettled ? { classId, slug } : "skip",
    { initialNumItems: TASK_PAGE_SIZE }
  );
  if (
    PaginatedQueryResult.isFailure(pagination) &&
    isLostAccess(pagination.error)
  ) {
    throw pagination.error;
  }
  const loadingFirst = pagination._tag === "LoadingFirstPage";
  const failed = PaginatedQueryResult.isFailure(pagination);
  const empty =
    !(loadingFirst || failed) && Arr.isReadonlyArrayEmpty(pagination.results);

  return (
    <TableFiltersProvider>
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
        {loadingFirst || failed || empty ? null : (
          <DataTable
            columns={columns}
            data={pagination.results}
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
    </TableFiltersProvider>
  );
}

/**
 * The columns of the task table: each task's title, which opens it, its deadline, and where it
 * stands, the viewer's own work for a student and the number of work handed in for a teacher.
 */
function useTaskColumns() {
  const t = useTranslations("Classroom");
  const format = useFormatter();

  return taskColumns.columns([
    taskColumns.accessor((task) => task.title, {
      cell: (info) => <TaskTitle task={info.row.original} />,
      enableSorting: false,
      filterFn: "includesString",
      header: t("task-title"),
      id: "title",
    }),
    taskColumns.accessor((task) => task.deadline, {
      cell: (info) => (
        <span className="text-muted-foreground tabular-nums">
          {format.dateTime(
            DateTime.toDateUtc(DateTime.makeUnsafe(info.getValue())),
            { dateStyle: "medium", timeStyle: "short" }
          )}
        </span>
      ),
      enableSorting: false,
      header: t("task-deadline"),
      id: "deadline",
    }),
    taskColumns.display({
      cell: (info) => (
        <span className="text-muted-foreground">
          <TaskStanding task={info.row.original} />
        </span>
      ),
      header: t("task-status"),
      id: "status",
    }),
  ]);
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
  if (task.mine === null) {
    return t("task-not-handed-in");
  }
  if (task.mine.score !== null) {
    return t("task-scored", { points: task.points, score: task.mine.score });
  }
  return task.mine.late ? t("task-handed-in-late") : t("task-handed-in");
}
