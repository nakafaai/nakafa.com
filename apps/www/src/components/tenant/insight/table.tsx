import type { GenericId } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import insight from "@repo/backend/confect/_generated/refs/insight";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { TableEmpty, TableFrame } from "@/components/shared/table/frame";
import { TableFiltersProvider } from "@/components/shared/table/toolbar";
import { useTenant } from "@/components/tenant/context";
import { StudentNarrative } from "@/components/tenant/insight/narrative";
import { SharedPractice } from "@/components/tenant/insight/practice";
import { percentOf, skillRowsOf } from "@/components/tenant/insight/rows";
import { QuestionTags } from "@/components/tenant/insight/tags";
import { Link } from "@/lib/routing/link";

/** The columns of a class's standing. */
const skillColumns = tableColumns<ReturnType<typeof skillRowsOf>[number]>();

/**
 * One class as its teacher reads it: each student's competencies with the points behind them and, while the forecast
 * passes its monthly test, the chance of reaching the KKTP, which only a teacher sees and which never changes a grade
 * (ADR 0035). Below them come the practice students share, and each student's narrative.
 */
export function ClassInsightTable({
  classId,
}: {
  classId: GenericId.GenericId<"classes">;
}) {
  const t = useTranslations("SchoolInsight");
  const { slug } = useTenant();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const found = useQuery(
    insight.reads.ofClass,
    isSettled ? { classId, slug } : "skip"
  );

  if (QueryResult.isFailure(found)) {
    throw found.error;
  }
  if (!QueryResult.isSuccess(found)) {
    return null;
  }
  const rows = skillRowsOf(found.value.students);

  return (
    <>
      {Arr.isReadonlyArrayEmpty(rows) ? (
        <TableEmpty
          act="pointing"
          action={
            <>
              <Link
                className={buttonVariants()}
                params={{ slug }}
                to="/school/$slug/exams"
              >
                {t("exams-action")}
              </Link>
              <QuestionTags />
            </>
          }
          description={t("class-empty-description")}
          title={t("class-empty")}
        />
      ) : (
        <TableFiltersProvider>
          <TableFrame>
            <DataTable
              columns={[
                skillColumns.text((row) => row.student, {
                  cell: (info) => <span dir="auto">{info.getValue()}</span>,
                  header: t("student"),
                  id: "student",
                }),
                skillColumns.text((row) => row.competency, {
                  cell: (info) => <span dir="auto">{info.getValue()}</span>,
                  header: t("competency"),
                  id: "competency",
                }),
                skillColumns.number((row) => percentOf(row.rating), {
                  header: t("mastery"),
                  id: "mastery",
                }),
                skillColumns.number((row) => row.earned, {
                  cell: (info) =>
                    t("evidence-points", {
                      earned: info.getValue(),
                      possible: info.row.original.possible,
                    }),
                  header: t("evidence"),
                  id: "evidence",
                }),
                ...(found.value.forecasts
                  ? [
                      skillColumns.number(
                        (row) =>
                          row.chance === null ? null : percentOf(row.chance),
                        {
                          header: t("chance", { kktp: found.value.kktp }),
                          id: "chance",
                        }
                      ),
                    ]
                  : []),
              ]}
              data={rows}
              rowId={(row) => row.key}
            />
          </TableFrame>
        </TableFiltersProvider>
      )}
      {Arr.isReadonlyArrayEmpty(rows) ? null : (
        <>
          <p className="text-muted-foreground text-sm">
            {found.value.forecasts ? t("chance-note") : t("chance-held")}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted-foreground text-sm">{t("tags-note")}</p>
            <QuestionTags />
          </div>
        </>
      )}
      <SharedPractice students={found.value.students} />
      <p className="text-muted-foreground text-sm">{t("narratives-note")}</p>
      <div className="flex flex-wrap gap-2">
        {Arr.map(found.value.students, (student) => (
          <StudentNarrative
            classId={classId}
            key={student.id}
            student={student}
          />
        ))}
      </div>
    </>
  );
}
