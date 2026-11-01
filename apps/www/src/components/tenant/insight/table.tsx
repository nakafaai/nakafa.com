import type { GenericId } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import insight from "@repo/backend/confect/_generated/refs/insight";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { columnAlign } from "@/components/shared/table/align";
import { TableEmpty, TableFrame } from "@/components/shared/table/frame";
import { useTenant } from "@/components/tenant/context";
import { StudentNarrative } from "@/components/tenant/insight/narrative";
import { SharedPractice } from "@/components/tenant/insight/practice";
import { percentOf, skillRowsOf } from "@/components/tenant/insight/rows";

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
          act="waving"
          description={t("empty-description")}
          title={t("empty")}
        />
      ) : (
        <TableFrame>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={columnAlign({ align: "start" })}>
                  {t("student")}
                </TableHead>
                <TableHead className={columnAlign({ align: "start" })}>
                  {t("competency")}
                </TableHead>
                <TableHead className={columnAlign()}>{t("mastery")}</TableHead>
                <TableHead className={columnAlign()}>{t("evidence")}</TableHead>
                {found.value.forecasts ? (
                  <TableHead className={columnAlign()}>
                    {t("chance", { kktp: found.value.kktp })}
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Arr.map(rows, (row) => (
                <TableRow key={row.key}>
                  <TableCell
                    className={columnAlign({ align: "start" })}
                    dir="auto"
                  >
                    {row.student}
                  </TableCell>
                  <TableCell
                    className={columnAlign({ align: "start" })}
                    dir="auto"
                  >
                    {row.competency}
                  </TableCell>
                  <TableCell className={columnAlign()}>
                    {percentOf(row.rating)}
                  </TableCell>
                  <TableCell className={columnAlign()}>
                    {t("evidence-points", {
                      earned: row.earned,
                      possible: row.possible,
                    })}
                  </TableCell>
                  {row.chance === null ? null : (
                    <TableCell className={columnAlign()}>
                      {percentOf(row.chance)}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableFrame>
      )}
      <p className="text-muted-foreground text-sm">
        {found.value.forecasts ? t("chance-note") : t("chance-held")}
      </p>
      <SharedPractice students={found.value.students} />
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
