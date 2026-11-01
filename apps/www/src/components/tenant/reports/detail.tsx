import type { Ref } from "@confect/core";
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
import { PopupHold } from "@repo/design-system/components/ui/hold";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { getRouteApi } from "@tanstack/react-router";
import { Array as Arr, Option, Record as Rec } from "effect";
import { useId, useState, useTransition } from "react";
import { useLocale, useTranslations } from "use-intl";
import {
  PaneBody,
  PaneFact,
  PaneFacts,
  PaneFooter,
  PaneHeader,
} from "@/components/shared/pane";
import { usePanes } from "@/components/shared/panes";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { TableFrame } from "@/components/shared/table/frame";
import { TableFiltersProvider } from "@/components/shared/table/toolbar";
import { useTenant } from "@/components/tenant/context";
import { menuOf } from "@/components/tenant/reports/access";
import { useReportActions } from "@/components/tenant/reports/actions";
import {
  type ReportLine,
  writeChange,
} from "@/components/tenant/reports/change";
import { checkAddress } from "@/components/tenant/reports/check";
import { saveSchool } from "@/components/tenant/settings/save";
import { SchoolDateTime } from "@/components/tenant/settings/time";

const SOURCE = "components/tenant/reports/detail";

/** The route of one class group's report cards, whose context holds the class group's ID. */
const cohortRoute = getRouteApi("/school/$slug/reports/$cohortId");

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

  if (Option.isNone(line)) {
    return null;
  }
  const found = line.value;
  return (
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
  );
}

/** The columns of a report's subjects. */
const subjectColumns =
  tableColumns<Ref.Returns<typeof records.reports.get>["subjects"][number]>();

/** The body of a started report: its state and dates, the note, and the subjects it copies. */
function ReportDetailBody({ reportId }: { reportId: Id<"reportCards"> }) {
  const t = useTranslations("SchoolReports");
  const { slug } = useTenant();
  const detail = useQuery(records.reports.get, { reportId, slug });

  if (!QueryResult.isSuccess(detail)) {
    return (
      <PaneBody>
        <PopupHold />
      </PaneBody>
    );
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
          <TableFiltersProvider>
            <TableFrame>
              <DataTable
                columns={[
                  subjectColumns.text((subject) => subject.className, {
                    cell: (info) => <span dir="auto">{info.getValue()}</span>,
                    header: t("subject"),
                    id: "subject",
                  }),
                  subjectColumns.number((subject) => subject.value, {
                    header: t("grade"),
                    id: "grade",
                  }),
                  subjectColumns.text(
                    (subject) => subject.band ?? t(`kktp-${subject.kktp}`),
                    { header: t("result"), id: "result" }
                  ),
                ]}
                data={report.subjects}
                plain
                rowId={(subject) => subject.className}
              />
            </TableFrame>
          </TableFiltersProvider>
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
  const [isWriting, setIsWriting] = useState(false);
  const menu = menuOf(line);

  if (!Rec.some(menu, (shown) => shown)) {
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
      {line.report === null ? null : (
        <ReportStateButtons menu={menu} report={line.report} />
      )}
      {menu.write ? (
        <ReportNoteDialog line={line} open={isWriting} setOpen={setIsWriting} />
      ) : null}
    </PaneFooter>
  );
}

/**
 * The actions on a report that exists: hand in a draft, take back or approve a handed-in
 * report, and open the check page and the PDF of a locked one.
 */
function ReportStateButtons({
  menu,
  report,
}: {
  menu: ReturnType<typeof menuOf>;
  report: NonNullable<ReportLine["report"]>;
}) {
  const t = useTranslations("SchoolReports");
  const locale = useLocale();
  const actions = useReportActions();

  return (
    <>
      {menu.reopen ? (
        <Button
          onClick={() => actions.reopen(report.id)}
          type="button"
          variant="outline"
        >
          <HugeIcons icon={ArrowTurnBackwardIcon} />
          {t("reopen")}
        </Button>
      ) : null}
      {menu.complete ? (
        <Button onClick={() => actions.complete(report.id)} type="button">
          <HugeIcons icon={SentIcon} />
          {t("complete")}
        </Button>
      ) : null}
      {menu.approve ? (
        <Button onClick={() => actions.approve(report.id)} type="button">
          <HugeIcons icon={CheckmarkCircle02Icon} />
          {t("approve")}
        </Button>
      ) : null}
      {menu.open && report.hash !== null ? (
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
      {menu.open ? <ReportFileButton reportId={report.id} /> : null}
    </>
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
            onClick={() => {
              setNote(line.report?.note ?? "");
              setOpen(false);
            }}
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
