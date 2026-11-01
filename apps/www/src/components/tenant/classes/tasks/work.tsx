import {
  PaginatedQueryResult,
  useMutation,
  usePaginatedQuery,
} from "@confect/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { TaskPoints } from "@repo/backend/confect/classroom/tasks/task";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@repo/design-system/components/ui/number";
import { Array as Arr, Option, Schema } from "effect";
import { useTranslations } from "use-intl";
import { reloadPage } from "@/components/shared/reload";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { TableEmpty, TableFrame } from "@/components/shared/table/frame";
import { RowCopy } from "@/components/shared/table/menu";
import { TableEnd } from "@/components/shared/table/pages";
import { TableName } from "@/components/shared/table/title";
import {
  TableSearch,
  useServerSearch,
} from "@/components/shared/table/toolbar";
import { LoadFailure } from "@/components/state/failure";
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

/** The columns of the work handed in. */
const workColumns = tableColumns<TaskWork>();

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
    return <LoadFailure onRetry={reloadPage} />;
  }
  const loadMore = PaginatedQueryResult.isCanLoadMore(pagination)
    ? () => pagination.loadMore(WORK_PAGE_SIZE)
    : null;

  return (
    <>
      <TableFrame>
        <DataTable
          columns={[
            workColumns.text((work) => work.person.name, {
              cell: (info) => <TableName>{info.getValue()}</TableName>,
              header: t("task-student"),
              id: "student",
            }),
            workColumns.text((work) => work.text, {
              cell: (info) => (
                <>
                  <p className="wrap-anywhere whitespace-pre-wrap" dir="auto">
                    {info.getValue()}
                  </p>
                  {info.row.original.late ? (
                    <p className="text-muted-foreground text-xs">
                      {t("task-handed-in-late")}
                    </p>
                  ) : null}
                </>
              ),
              header: t("task-work"),
              id: "work",
            }),
            workColumns.number((work) => work.score, {
              cell: (info) => (
                <WorkPoints points={task.points} work={info.row.original} />
              ),
              header: t("task-points"),
              id: "points",
            }),
            workColumns.menu((info) => (
              <RowCopy value={info.row.original.text} />
            )),
          ]}
          data={Option.getOrElse(kept, Arr.empty)}
          empty={<WorkEmpty searched={search !== ""} />}
          loading={!PaginatedQueryResult.isExhausted(pagination)}
          rowId={(work) => work.id}
        />
      </TableFrame>
      {loadMore === null ? null : <TableEnd onLoad={loadMore} />}
    </>
  );
}

/** The work table once it is read without a row: a task with no work yet, or a search that matches none. */
function WorkEmpty({ searched }: { readonly searched: boolean }) {
  const t = useTranslations("Classroom");
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
 * The points of one student's work, in a field. A changed number gives the points at once when the field
 * loses focus, and a refusal brings the old points back with the toast every School action uses.
 */
function WorkPoints({ points, work }: { points: number; work: TaskWork }) {
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
  );
}
