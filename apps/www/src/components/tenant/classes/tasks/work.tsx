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
import { columnAlign } from "@/components/shared/table/align";
import { TableEmpty, TableFrame } from "@/components/shared/table/frame";
import {
  TableSearch,
  useServerSearch,
} from "@/components/shared/table/toolbar";
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
import { useKeptRows } from "@/lib/data/kept";

/** How many pieces of work the table reads each time its end comes into view. */
const WORK_PAGE_SIZE = 30;

/** The search of the work handed in, in the task page's header, for its teacher. */
export function TaskWorkSearch() {
  const t = useTranslations("Classroom");
  return <TableSearch placeholder={t("task-work-search")} />;
}

/**
 * The work handed in for a task, as its teacher reads it: each student, the work, whether it came
 * late, and its points, which the teacher gives in place. The next page loads as the end of the
 * table comes into view. The header's search reads the work of the students whose names match it,
 * on the server, and the work already shown stays while a new search's first page loads. A task
 * with no work yet shows its empty state, and a search that matches no work says so once the list
 * ends.
 */
export function TaskWorkTable({ task }: { task: ClassTask }) {
  const t = useTranslations("Classroom");
  const { classId, slug } = useClassScope();
  const search = useServerSearch();
  const pagination = usePaginatedQuery(
    classroom.tasks.submissions,
    {
      classId,
      slug,
      task: task.slug,
      ...(search === "" ? {} : { search }),
    },
    { initialNumItems: WORK_PAGE_SIZE }
  );
  const kept = useKeptRows(
    PaginatedQueryResult.isLoadingFirstPage(pagination),
    pagination.results
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
  if (Option.isNone(kept)) {
    return null;
  }
  const loadMore = PaginatedQueryResult.isCanLoadMore(pagination)
    ? () => pagination.loadMore(WORK_PAGE_SIZE)
    : null;
  if (Arr.isReadonlyArrayEmpty(kept.value)) {
    return (
      <WorkEmpty
        exhausted={PaginatedQueryResult.isExhausted(pagination)}
        loadMore={loadMore}
        searched={search !== ""}
      />
    );
  }

  return (
    <>
      <TableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={columnAlign({ align: "start" })}>
                {t("task-student")}
              </TableHead>
              <TableHead className={columnAlign({ align: "start" })}>
                {t("task-work")}
              </TableHead>
              <TableHead className={columnAlign({ className: "w-32" })}>
                {t("task-points")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Arr.map(kept.value, (work) => (
              <WorkRow key={work.id} points={task.points} work={work} />
            ))}
          </TableBody>
        </Table>
      </TableFrame>
      {loadMore === null ? null : <Intersection onIntersect={loadMore} />}
    </>
  );
}

/**
 * The work table without a row: while a search's later pages may still hold a match, only the sentinel that reads
 * the next one; then the empty state, of a task with no work yet or of a search that matches none.
 */
function WorkEmpty({
  exhausted,
  loadMore,
  searched,
}: {
  /** Whether the list has no more pages, so an empty list is its end and not a wait. */
  readonly exhausted: boolean;
  /** Loads the next page, or `null` while one loads or once the list ends. */
  readonly loadMore: (() => void) | null;
  readonly searched: boolean;
}) {
  const t = useTranslations("Classroom");
  if (searched && !exhausted) {
    return loadMore === null ? null : <Intersection onIntersect={loadMore} />;
  }
  return (
    <TableEmpty
      act="reading"
      description={t(
        searched
          ? "task-work-no-match-description"
          : "task-work-empty-description"
      )}
      title={t(searched ? "task-work-no-match" : "task-work-empty")}
    />
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
      <TableCell
        className={columnAlign({
          align: "start",
          className: "align-top font-medium",
        })}
        dir="auto"
      >
        {work.person.name}
      </TableCell>
      <TableCell
        className={columnAlign({ align: "start", className: "align-top" })}
      >
        <p className="wrap-anywhere whitespace-pre-wrap" dir="auto">
          {work.text}
        </p>
        {work.late ? (
          <p className="text-muted-foreground text-xs">
            {t("task-handed-in-late")}
          </p>
        ) : null}
      </TableCell>
      <TableCell className={columnAlign({ className: "align-top" })}>
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
