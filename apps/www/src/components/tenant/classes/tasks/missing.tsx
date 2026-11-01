import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import type { MissingStudent } from "@repo/backend/confect/classroom/tasks/task";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { reloadPage } from "@/components/shared/reload";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { TableFrame } from "@/components/shared/table/frame";
import { LoadFailure } from "@/components/state/failure";
import { useClassScope } from "@/components/tenant/classes/scope";
import type { ClassTask } from "@/components/tenant/classes/tasks/optimistic";
import { isLostAccess } from "@/components/tenant/refusal";

/** How many students the table reads each time its end comes into view. */
const MISSING_PAGE_SIZE = 30;

/** The columns of the students who have handed nothing in. */
const missingColumns = tableColumns<typeof MissingStudent.Type>();

/**
 * The students a task reaches who have handed nothing in, under the work that came in, so a teacher
 * sees who to chase without reading the whole class. The header's search filters them too, and the
 * section leaves the page once every student has handed work in.
 */
export function TaskMissingTable({ task }: { task: ClassTask }) {
  const t = useTranslations("Classroom");
  const { classId, slug } = useClassScope();
  const pagination = usePaginatedQuery(
    classroom.tasks.missing,
    { classId, slug, task: task.slug },
    { initialNumItems: MISSING_PAGE_SIZE }
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
  if (Arr.isReadonlyArrayEmpty(pagination.results)) {
    return null;
  }
  const loadMore = PaginatedQueryResult.isCanLoadMore(pagination)
    ? () => pagination.loadMore(MISSING_PAGE_SIZE)
    : null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">{t("task-missing")}</h2>
      <TableFrame>
        <DataTable
          columns={[
            missingColumns.text((student) => student.name, {
              cell: (info) => (
                <span className="font-medium" dir="auto">
                  {info.getValue()}
                </span>
              ),
              header: t("task-student"),
              id: "name",
            }),
          ]}
          data={pagination.results}
          rowId={(student) => student.id}
          search="name"
        />
      </TableFrame>
      {loadMore === null ? null : <Intersection onIntersect={loadMore} />}
    </section>
  );
}
