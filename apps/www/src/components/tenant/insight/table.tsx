import type { GenericId } from "@confect/core";
import { QueryResult, useMutation, useQuery } from "@confect/react";
import insight from "@repo/backend/confect/_generated/refs/insight";
import { Button } from "@repo/design-system/components/ui/button";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { Array as Arr } from "effect";
import { useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { columnAlign } from "@/components/shared/table/align";
import { TableEmpty, TableFrame } from "@/components/shared/table/frame";
import { useTenant } from "@/components/tenant/context";
import {
  type InsightStudent,
  percentOf,
  skillRowsOf,
} from "@/components/tenant/insight/rows";
import { saveSchool } from "@/components/tenant/settings/save";

const SOURCE = "components/tenant/insight/table";

/** The longest narrative, which the server also holds a teacher to. */
const NARRATIVE_LIMIT = 4000;

/**
 * One class as its teacher reads it: each student's competencies with the points behind them and the chance of
 * reaching the KKTP, which only a teacher sees and which never changes a grade (ADR 0035), and below them each
 * student's narrative.
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
                <TableHead className={columnAlign()}>
                  {t("chance", { kktp: found.value.kktp })}
                </TableHead>
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
                  <TableCell className={columnAlign()}>
                    {percentOf(row.chance)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableFrame>
      )}
      <p className="text-muted-foreground text-sm">{t("chance-note")}</p>
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

/** One student's narrative: the teacher writes it, shares it with the guardians, and takes it back from the same place. */
function StudentNarrative({
  classId,
  student,
}: {
  classId: GenericId.GenericId<"classes">;
  student: InsightStudent;
}) {
  const t = useTranslations("SchoolInsight");
  const common = useTranslations("Common");
  const { slug } = useTenant();
  const names = { classId, personId: student.id, slug };
  const write = useMutation(insight.narratives.write);
  const share = useMutation(insight.narratives.share);
  const withdraw = useMutation(insight.narratives.withdraw);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(student.narrative?.text ?? "");
  const [isSaving, startSaving] = useTransition();
  const shared = student.narrative?.shared === true;
  const saved = student.narrative !== null;

  return (
    <>
      <Button onClick={() => setOpen(true)} type="button" variant="outline">
        {student.name}
      </Button>
      <ResponsiveDialog
        description={t("narrative-description")}
        footer={
          <>
            <Button
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              {common("cancel")}
            </Button>
            {saved ? (
              <Button
                disabled={isSaving}
                onClick={() =>
                  startSaving(() =>
                    saveSchool(
                      () => (shared ? withdraw(names) : share(names)),
                      SOURCE
                    )
                  )
                }
                type="button"
                variant="outline"
              >
                {shared ? t("narrative-withdraw") : t("narrative-share")}
              </Button>
            ) : null}
            <Button
              disabled={isSaving || text.trim() === ""}
              onClick={() =>
                startSaving(() =>
                  saveSchool(
                    () => write({ ...names, text: text.trim() }),
                    SOURCE
                  )
                )
              }
              type="button"
            >
              {t("narrative-save")}
            </Button>
          </>
        }
        open={open}
        setOpen={setOpen}
        title={t("narrative-title", { student: student.name })}
      >
        <Textarea
          aria-label={t("narrative-title", { student: student.name })}
          maxLength={NARRATIVE_LIMIT}
          onChange={(event) => setText(event.target.value)}
          placeholder={t("narrative-placeholder")}
          rows={6}
          value={text}
        />
      </ResponsiveDialog>
    </>
  );
}
