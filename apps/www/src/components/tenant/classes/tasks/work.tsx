import {
  PaginatedQueryResult,
  useMutation,
  usePaginatedQuery,
} from "@confect/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { TaskPoints } from "@repo/backend/confect/classroom/tasks/task";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@repo/design-system/components/ui/number";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { Array as Arr, Option, Schema } from "effect";
import { useTranslations } from "use-intl";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { TableEmpty, TableFrame } from "@/components/shared/table/frame";
import {
  forumCall,
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";
import { useClassScope } from "@/components/tenant/classes/scope";
import {
  type ClassTask,
  scoreUpdate,
  type TaskWork,
} from "@/components/tenant/classes/tasks/optimistic";
import { isLostAccess } from "@/components/tenant/refusal";

/** How many pieces of work the table reads each time its end comes into view. */
const WORK_PAGE_SIZE = 30;

/**
 * The work handed in for a task, as its teacher reads it: each student, the work, whether it came
 * late, and its points, which the teacher gives in place. The next page loads as the end of the
 * table comes into view. A task with no work yet shows its empty state.
 */
export function TaskWorkTable({ task }: { task: ClassTask }) {
  const t = useTranslations("Classroom");
  const { classId, slug } = useClassScope();
  const pagination = usePaginatedQuery(
    classroom.tasks.submissions,
    { classId, slug, task: task.slug },
    { initialNumItems: WORK_PAGE_SIZE }
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
        act="reading"
        description={t("task-work-empty-description")}
        title={t("task-work-empty")}
      />
    );
  }

  return (
    <>
      <TableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("task-student")}</TableHead>
              <TableHead>{t("task-work")}</TableHead>
              <TableHead className="w-32">{t("task-points")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Arr.map(pagination.results, (work) => (
              <WorkRow key={work.id} points={task.points} work={work} />
            ))}
          </TableBody>
        </Table>
      </TableFrame>
      {PaginatedQueryResult.isCanLoadMore(pagination) ? (
        <Intersection onIntersect={() => pagination.loadMore(WORK_PAGE_SIZE)} />
      ) : null}
    </>
  );
}

/**
 * One student's work: the student, the work and whether it came late, and its points in a field. A
 * changed number gives the points at once when the field loses focus, and a refusal brings the old
 * points back with the toast every School action uses.
 */
function WorkRow({ points, work }: { points: number; work: TaskWork }) {
  const t = useTranslations("Classroom");
  const { classId, slug } = useClassScope();
  const score = useMutation(classroom.tasks.score);

  const give = (value: number | null) => {
    const parsed = Option.filter(
      Option.fromNullOr(value),
      Schema.is(TaskPoints)
    );
    if (
      Option.isNone(parsed) ||
      parsed.value > points ||
      parsed.value === work.score
    ) {
      return;
    }
    runForumCall(
      forumCall(() =>
        score.withOptimisticUpdate(scoreUpdate)({
          classId,
          points: parsed.value,
          slug,
          submissionId: work.id,
        })
      ),
      toastForumFailure
    );
  };

  return (
    <TableRow>
      <TableCell className="align-top font-medium" dir="auto">
        {work.person.name}
      </TableCell>
      <TableCell className="align-top">
        <p className="wrap-anywhere whitespace-pre-wrap" dir="auto">
          {work.text}
        </p>
        {work.late ? (
          <p className="text-muted-foreground text-xs">
            {t("task-handed-in-late")}
          </p>
        ) : null}
      </TableCell>
      <TableCell className="align-top">
        <NumberField
          defaultValue={work.score ?? undefined}
          key={work.score}
          max={points}
          min={0}
          onValueCommitted={give}
        >
          <NumberFieldGroup>
            <NumberFieldDecrement />
            <NumberFieldInput
              aria-label={t("task-points-for", { name: work.person.name })}
            />
            <NumberFieldIncrement />
          </NumberFieldGroup>
        </NumberField>
      </TableCell>
    </TableRow>
  );
}
