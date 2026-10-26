import { PaginatedQueryResult } from "@confect/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { Array as Arr, DateTime, Option } from "effect";
import { useFormatter, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { TableEmpty, TableFrame } from "@/components/shared/table/frame";
import { useClassScope } from "@/components/tenant/classes/scope";
import type { ClassTask } from "@/components/tenant/classes/tasks/optimistic";
import { isLostAccess } from "@/components/tenant/refusal";
import { usePaginatedPreloaded } from "@/lib/data/paginated";
import { TargetLink } from "@/lib/routing/link";
import { schoolClassTaskTarget } from "@/lib/routing/school/target";

/** How many tasks the list reads each time its end comes into view. */
const TASK_PAGE_SIZE = 20;

/**
 * The tasks of a class by deadline, the soonest first, in a table that fills the page: each task's
 * title, which opens it, its deadline, and where it stands, the viewer's own work for a student and
 * the number of work handed in for a teacher. The next page loads when the end comes into view. A
 * class with no task shows its empty state, a failed read its sentence and Try again, and a viewer
 * who lost the school's access is sent to the refused page.
 */
export function TaskList({ teacher }: { teacher: boolean }) {
  const t = useTranslations("Classroom");
  const { classId, slug } = useClassScope();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const pagination = usePaginatedPreloaded(
    classroom.tasks.list,
    isSettled ? { classId, slug } : "skip",
    { initialNumItems: TASK_PAGE_SIZE },
    Option.none()
  );
  if (
    PaginatedQueryResult.isFailure(pagination) &&
    isLostAccess(pagination.error)
  ) {
    throw pagination.error;
  }
  if (PaginatedQueryResult.isFailure(pagination)) {
    return <DataFailure onRetry={reloadPage} />;
  }
  if (pagination._tag === "LoadingFirstPage") {
    return null;
  }
  if (Arr.isReadonlyArrayEmpty(pagination.results)) {
    return (
      <TableEmpty
        act="writing"
        description={t("tasks-empty-description")}
        title={t("tasks-empty")}
      />
    );
  }

  return (
    <>
      <TableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("task-title")}</TableHead>
              <TableHead>{t("task-deadline")}</TableHead>
              <TableHead>{t("task-status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Arr.map(pagination.results, (task) => (
              <TaskRow key={task.id} task={task} teacher={teacher} />
            ))}
          </TableBody>
        </Table>
      </TableFrame>
      {PaginatedQueryResult.isCanLoadMore(pagination) ? (
        <Intersection onIntersect={() => pagination.loadMore(TASK_PAGE_SIZE)} />
      ) : null}
    </>
  );
}

/** One task of the list: its title, which opens it, its deadline, and where it stands for the viewer. */
function TaskRow({ task, teacher }: { task: ClassTask; teacher: boolean }) {
  const format = useFormatter();
  const { classSlug, slug } = useClassScope();

  return (
    <TableRow>
      <TableCell className="font-medium" dir="auto">
        <TargetLink
          className="wrap-anywhere underline-offset-4 hover:underline"
          target={schoolClassTaskTarget(slug, classSlug, task.slug)}
        >
          {task.title}
        </TargetLink>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {format.dateTime(
          DateTime.toDateUtc(DateTime.makeUnsafe(task.deadline)),
          {
            dateStyle: "medium",
            timeStyle: "short",
          }
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">
        <TaskStanding task={task} teacher={teacher} />
      </TableCell>
    </TableRow>
  );
}

/** Where a task stands: how many handed work in, for a teacher, or the viewer's own work. */
export function TaskStanding({
  task,
  teacher,
}: {
  task: ClassTask;
  teacher: boolean;
}) {
  const t = useTranslations("Classroom");
  if (teacher) {
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
