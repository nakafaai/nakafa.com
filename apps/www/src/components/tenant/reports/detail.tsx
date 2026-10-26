import { QueryResult, useMutation, useQuery } from "@confect/react";
import {
  ArrowTurnBackwardIcon,
  CheckmarkBadge01Icon,
  CheckmarkCircle02Icon,
  Download04Icon,
  PencilEdit02Icon,
  SentIcon,
} from "@hugeicons/core-free-icons";
import type { Id } from "@repo/backend/confect/_generated/id";
import records from "@repo/backend/confect/_generated/refs/records";
import { NOTE_LIMIT } from "@repo/backend/confect/records/report";
import { Button } from "@repo/design-system/components/ui/button";
import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
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
import { SITE_ORIGIN } from "@repo/seo/origin";
import { getRouteApi } from "@tanstack/react-router";
import { Array as Arr, Option } from "effect";
import { useId, useState, useTransition } from "react";
import { useLocale, useTranslations } from "use-intl";
import {
  PaneBody,
  PaneFact,
  PaneFacts,
  PaneFooter,
  PaneHeader,
  usePanes,
} from "@/components/shared/panes";
import { TableFrame } from "@/components/shared/table/frame";
import { useTenant } from "@/components/tenant/context";
import { menuOf } from "@/components/tenant/reports/access";
import {
  type ReportLine,
  stateChange,
  writeChange,
} from "@/components/tenant/reports/change";
import { saveSchool } from "@/components/tenant/settings/save";
import { SchoolDateTime } from "@/components/tenant/settings/time";

const SOURCE = "components/tenant/reports/detail";

/** The route of one class group's report cards, whose context holds the class group's ID. */
const cohortRoute = getRouteApi("/school/$slug/reports/$cohortId");

/** The public check page of a locked report, on the main site, in the viewer's language. */
export const checkAddress = (locale: string, hash: string) =>
  new URL(`/${locale}/verify/${hash}`, SITE_ORIGIN).href;

/**
 * Hands a report in, takes it back, or approves it, each shown at once on the list and
 * undone if the server refuses it. The row menu and the open report share them.
 */
export function useReportActions() {
  const { slug } = useTenant();
  const complete = useMutation(records.reports.complete).withOptimisticUpdate(
    stateChange("completed")
  );
  const reopen = useMutation(records.reports.reopen).withOptimisticUpdate(
    stateChange("draft")
  );
  const approve = useMutation(records.reports.approve).withOptimisticUpdate(
    stateChange("approved")
  );
  const [, startTransition] = useTransition();

  return {
    approve: (reportId: Id<"reportCards">) =>
      startTransition(() =>
        saveSchool(() => approve({ reportId, slug }), SOURCE)
      ),
    complete: (reportId: Id<"reportCards">) =>
      startTransition(() =>
        saveSchool(() => complete({ reportId, slug }), SOURCE)
      ),
    reopen: (reportId: Id<"reportCards">) =>
      startTransition(() =>
        saveSchool(() => reopen({ reportId, slug }), SOURCE)
      ),
  };
}

/**
 * The open student's report card: its state, the homeroom teacher's note, and the copy of
 * the released grades; then the actions the server allows in the footer. A student without
 * a report yet shows only the way to start one. A student the list no longer holds closes.
 */
export function ReportLineDetail({ lines }: { lines: readonly ReportLine[] }) {
  const t = useTranslations("SchoolReports");
  const open = usePanes((state) => state.open);
  const line = Option.flatMap(open, (id) =>
    Arr.findFirst(lines, (candidate) => candidate.student.id === id)
  );

  return Option.match(line, {
    onNone: () => null,
    onSome: (found) => (
      <>
        <PaneHeader
          description={t(`state-${found.report?.state ?? "none"}`)}
          title={found.student.name}
        />
        {found.report === null ? (
          <PaneBody>
            <p className="text-muted-foreground text-sm">{t("report-empty")}</p>
          </PaneBody>
        ) : (
          <ReportDetailBody reportId={found.report.id} />
        )}
        <ReportDetailFooter line={found} />
      </>
    ),
  });
}

/** The body of a started report: its state and dates, the note, and the subjects it copies. */
function ReportDetailBody({ reportId }: { reportId: Id<"reportCards"> }) {
  const t = useTranslations("SchoolReports");
  const { slug } = useTenant();
  const detail = useQuery(records.reports.get, { reportId, slug });

  if (!QueryResult.isSuccess(detail)) {
    return <PaneBody>{null}</PaneBody>;
  }
  const report = detail.value;

  return (
    <PaneBody>
      <div className="flex flex-col gap-6">
        <PaneFacts>
          <PaneFact label={t("status")}>{t(`state-${report.state}`)}</PaneFact>
          {report.approvedAt === null ? null : (
            <PaneFact label={t("approved-at")}>
              <SchoolDateTime at={report.approvedAt} />
            </PaneFact>
          )}
          <PaneFact label={t("note-label")}>
            {report.note === "" ? (
              <span className="text-muted-foreground">{t("note-empty")}</span>
            ) : (
              <span className="whitespace-pre-wrap">{report.note}</span>
            )}
          </PaneFact>
        </PaneFacts>
        {Arr.isReadonlyArrayEmpty(report.subjects) ? (
          <p className="text-muted-foreground text-sm">{t("subjects-empty")}</p>
        ) : (
          <TableFrame>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("subject")}</TableHead>
                  <TableHead className="text-end">{t("grade")}</TableHead>
                  <TableHead>{t("result")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Arr.map(report.subjects, (subject) => (
                  <TableRow key={subject.className}>
                    <TableCell dir="auto">{subject.className}</TableCell>
                    <TableCell className="text-end tabular-nums">
                      {subject.value}
                    </TableCell>
                    <TableCell>
                      {subject.band ?? t(`kktp-${subject.kktp}`)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableFrame>
        )}
      </div>
    </PaneBody>
  );
}

/**
 * The open report's actions: write the note and hand in for the homeroom teacher, take back
 * and approve a handed-in report, and open the PDF and the check page of a locked one. A
 * report with no allowed action has no footer.
 */
function ReportDetailFooter({ line }: { line: ReportLine }) {
  const t = useTranslations("SchoolReports");
  const locale = useLocale();
  const actions = useReportActions();
  const [isWriting, setIsWriting] = useState(false);
  const menu = menuOf(line);
  const { report } = line;

  if (
    !(menu.write || menu.complete || menu.reopen || menu.approve || menu.open)
  ) {
    return null;
  }

  return (
    <PaneFooter>
      {menu.write ? (
        <Button
          onClick={() => setIsWriting(true)}
          type="button"
          variant={menu.complete ? "outline" : "default"}
        >
          <HugeIcons icon={PencilEdit02Icon} />
          {t("write")}
        </Button>
      ) : null}
      {menu.reopen && report !== null ? (
        <Button
          onClick={() => actions.reopen(report.id)}
          type="button"
          variant="outline"
        >
          <HugeIcons icon={ArrowTurnBackwardIcon} />
          {t("reopen")}
        </Button>
      ) : null}
      {menu.complete && report !== null ? (
        <Button onClick={() => actions.complete(report.id)} type="button">
          <HugeIcons icon={SentIcon} />
          {t("complete")}
        </Button>
      ) : null}
      {menu.approve && report !== null ? (
        <Button onClick={() => actions.approve(report.id)} type="button">
          <HugeIcons icon={CheckmarkCircle02Icon} />
          {t("approve")}
        </Button>
      ) : null}
      {menu.open && report !== null && report.hash !== null ? (
        <Button
          render={
            <a
              href={checkAddress(locale, report.hash)}
              rel="noopener"
              target="_blank"
            >
              <HugeIcons icon={CheckmarkBadge01Icon} />
              {t("open-check")}
            </a>
          }
          variant="outline"
        />
      ) : null}
      {menu.open && report !== null ? (
        <ReportFileButton reportId={report.id} />
      ) : null}
      {menu.write ? (
        <ReportNoteDialog line={line} open={isWriting} setOpen={setIsWriting} />
      ) : null}
    </PaneFooter>
  );
}

/** The button that opens a locked report's PDF, once its file is read. */
function ReportFileButton({ reportId }: { reportId: Id<"reportCards"> }) {
  const t = useTranslations("SchoolReports");
  const { slug } = useTenant();
  const detail = useQuery(records.reports.get, { reportId, slug });
  const file = QueryResult.isSuccess(detail) ? detail.value.file : null;

  return (
    <Button
      disabled={file === null}
      render={
        <a href={file ?? undefined} rel="noopener" target="_blank">
          <HugeIcons icon={Download04Icon} />
          {t("open-pdf")}
        </a>
      }
    />
  );
}

/** The dialog where the homeroom teacher writes a student's note, which starts the draft. */
export function ReportNoteDialog({
  line,
  open,
  setOpen,
}: {
  line: ReportLine;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const t = useTranslations("SchoolReports");
  const { slug } = useTenant();
  const cohortId = cohortRoute.useRouteContext({
    select: (context) => context.cohortId,
  });
  const common = useTranslations("Common");
  const id = useId();
  const write = useMutation(records.reports.write).withOptimisticUpdate(
    writeChange
  );
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState(line.report?.note ?? "");

  const submit = () =>
    startTransition(() => {
      setOpen(false);
      return saveSchool(
        () => write({ cohortId, note, personId: line.student.id, slug }),
        SOURCE
      );
    });

  return (
    <ResponsiveDialog
      description={t("write-description", { name: line.student.name })}
      footer={
        <>
          <Button
            onClick={() => setOpen(false)}
            type="button"
            variant="outline"
          >
            {common("cancel")}
          </Button>
          <Button
            disabled={note.length > NOTE_LIMIT || isPending}
            inert={isPending}
            onClick={submit}
            type="button"
          >
            <HugeIcons icon={PencilEdit02Icon} />
            {t("save-note")}
          </Button>
        </>
      }
      open={open}
      setOpen={setOpen}
      title={t("write")}
    >
      <Field>
        <FieldLabel htmlFor={`${id}-note`}>{t("note-label")}</FieldLabel>
        <Textarea
          id={`${id}-note`}
          maxLength={NOTE_LIMIT}
          minRows={4}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t("note-placeholder")}
          value={note}
        />
      </Field>
    </ResponsiveDialog>
  );
}
