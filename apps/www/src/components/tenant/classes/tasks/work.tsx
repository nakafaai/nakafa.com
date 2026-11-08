import {
  PaginatedQueryResult,
  useMutation,
  usePaginatedQuery,
} from "@confect/react";
import {
  Copy01Icon,
  TaskDone01Icon,
  TimeQuarterPassIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { useClipboard } from "@mantine/hooks";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { TaskPoints } from "@repo/backend/confect/classroom/tasks/task";
import { Button } from "@repo/design-system/components/ui/button";
import { DropdownMenuItem } from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@repo/design-system/components/ui/number";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Array as Arr, Option, Schema } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { reloadPage } from "@/components/shared/reload";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { TableEmpty, TableFrame } from "@/components/shared/table/frame";
import { RowItems } from "@/components/shared/table/menu";
import { TableEnd } from "@/components/shared/table/pages";
import { TableName } from "@/components/shared/table/title";
import { useServerSearch } from "@/components/shared/table/toolbar";
import { LoadFailure } from "@/components/state/failure";
import { useClassScope } from "@/components/tenant/classes/scope";
import {
  type ClassTask,
  scoreUpdate,
  type TaskWork,
} from "@/components/tenant/classes/tasks/optimistic";
import { isLostAccess } from "@/components/tenant/refusal";
import { runSchoolWrite, schoolCall } from "@/components/tenant/write";
import { useKeptRows } from "@/lib/data/kept";

/** How many pieces of work the table reads each time its end comes into view. */
const WORK_PAGE_SIZE = 30;

/** The columns of the work handed in. */
const workColumns = tableColumns<TaskWork>();

/**
 * The work handed in for a task, as its teacher reads it in the task's pane, one row each: the
 * student, whether the work came late, and its points, which the teacher gives in place; the row's
 * menu opens the whole work to read. The next page loads as the end of the table comes into view.
 * The pane's search reads the work of the students whose names match it,
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
            workColumns.values((work) => (work.late ? "late" : "onTime"), {
              cell: (info) => (
                <span className="text-muted-foreground">
                  {info.row.original.late
                    ? t("task-handed-in-late")
                    : t("task-handed-in")}
                </span>
              ),
              header: t("task-status"),
              id: "late",
              options: [
                {
                  icon: TaskDone01Icon,
                  label: t("task-handed-in"),
                  value: "onTime" as const,
                },
                {
                  icon: TimeQuarterPassIcon,
                  label: t("task-handed-in-late"),
                  value: "late" as const,
                },
              ],
            }),
            workColumns.number((work) => work.score, {
              cell: (info) => (
                <WorkPoints points={task.points} work={info.row.original} />
              ),
              header: t("task-points"),
              id: "points",
            }),
            workColumns.menu((info) => <WorkMenu work={info.row.original} />),
          ]}
          data={Option.getOrElse(kept, Arr.empty)}
          empty={<WorkEmpty searched={search !== ""} />}
          loading={!PaginatedQueryResult.isExhausted(pagination)}
          plain
          rowId={(work) => work.id}
        />
      </TableFrame>
      {loadMore === null ? null : <TableEnd onLoad={loadMore} />}
    </>
  );
}

/**
 * What a row of the work table can do: read the student's whole work in a dialog, and copy it.
 * Each opening is a dialog of its own.
 */
function WorkMenu({ work }: { work: TaskWork }) {
  const t = useTranslations("Classroom");
  const common = useTranslations("Common");
  const clipboard = useClipboard();
  const [openings, setOpenings] = useState(0);

  return (
    <>
      <RowItems>
        <DropdownMenuItem onClick={() => setOpenings((count) => count + 1)}>
          <HugeIcons icon={ViewIcon} />
          {t("task-read")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => clipboard.copy(work.text)}>
          <HugeIcons icon={Copy01Icon} />
          {common("copy")}
        </DropdownMenuItem>
      </RowItems>
      {openings === 0 ? null : <WorkDialog key={openings} work={work} />}
    </>
  );
}

/** The whole work of one student, as they handed it in, and whether it came late. */
function WorkDialog({ work }: { work: TaskWork }) {
  const t = useTranslations("Classroom");
  const common = useTranslations("Common");
  const [open, setOpen] = useState(true);

  return (
    <ResponsiveDialog
      description={work.late ? t("task-handed-in-late") : t("task-handed-in")}
      footer={
        <Button onClick={() => setOpen(false)} variant="outline">
          {common("close")}
        </Button>
      }
      open={open}
      setOpen={setOpen}
      title={work.person.name}
    >
      <p className="text-sm wrap-anywhere whitespace-pre-wrap" dir="auto">
        {work.text}
      </p>
    </ResponsiveDialog>
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
    runSchoolWrite(
      schoolCall(() =>
        score.withOptimisticUpdate(scoreUpdate)({
          classId,
          points: parsed.value,
          slug,
          submissionId: work.id,
        })
      )
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
