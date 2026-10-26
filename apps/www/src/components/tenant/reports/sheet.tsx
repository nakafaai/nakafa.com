import {
  PaginatedQueryResult,
  QueryResult,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import {
  ArrowTurnBackwardIcon,
  CheckmarkBadge01Icon,
  CheckmarkCircle02Icon,
  Download04Icon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
  SentIcon,
} from "@hugeicons/core-free-icons";
import type { Id } from "@repo/backend/confect/_generated/id";
import records from "@repo/backend/confect/_generated/refs/records";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { NOTE_LIMIT } from "@repo/backend/confect/records/report";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr } from "effect";
import { useId, useState, useTransition } from "react";
import { useLocale, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { LayoutContent } from "@/components/shared/content/frame";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty } from "@/components/shared/table/frame";
import { SchoolHeader } from "@/components/tenant/header";
import { menuOf } from "@/components/tenant/reports/access";
import {
  type ReportLine,
  stateChange,
  writeChange,
} from "@/components/tenant/reports/change";
import { saveSchool } from "@/components/tenant/settings/save";
import { LOCALE_ROUTE } from "@/lib/routing/tree";

const SOURCE = "components/tenant/reports/sheet";

/** The public check page of a locked report, on the main site, in the viewer's language. */
const checkAddress = (locale: string, hash: string) =>
  new URL(`/${locale}/verify/${hash}`, SITE_ORIGIN).href;

/** How many students one page of the list loads, and each page after it. */
const PAGE_SIZE = 50;

/** The states a line's report is in, as the status filter offers them. */
const LINE_STATES = [
  "none",
  "draft",
  "completed",
  "approved",
  "locked",
] as const;

/** The columns of the report list. */
const lineColumns = createColumnHelper<typeof dataTableFeatures, ReportLine>();

/**
 * The report cards of one class group (ADR 0033, S4): each placed student with the state
 * of their report. The homeroom teacher writes a note and hands a report in, or takes it
 * back; the principal approves it, which draws its PDF and locks it. A locked report opens
 * its PDF.
 */
export function CohortReports({
  cohortId,
  slug,
}: {
  cohortId: Id<"tenantCohorts">;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolReports");
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const cohort = useQuery(
    tenancy.cohorts.get,
    isSettled ? { cohortId, slug } : "skip"
  );
  const pagination = usePaginatedQuery(
    records.reports.sheet,
    isSettled ? { cohortId, slug } : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const title = QueryResult.isSuccess(cohort) ? cohort.value.name : "";
  const header = (
    <SchoolHeader
      items={[
        {
          label: t("title"),
          target: {
            from: LOCALE_ROUTE,
            params: { slug },
            to: "/school/$slug/reports",
          },
        },
        { label: title },
      ]}
      title={title}
    />
  );

  if (pagination._tag === "LoadingFirstPage") {
    return header;
  }
  const failed = PaginatedQueryResult.isFailure(pagination);
  const columns = lineColumns.columns([
    lineColumns.accessor((line) => line.student.name, {
      cell: (info) => (
        <span className="font-medium" dir="auto">
          {info.getValue()}
        </span>
      ),
      filterFn: "includesString",
      header: t("student"),
      id: "student",
      sortFn: "text",
    }),
    lineColumns.accessor((line) => line.report?.state ?? "none", {
      cell: (info) => t(`state-${info.getValue()}`),
      enableSorting: false,
      filterFn: "oneOf",
      header: t("status"),
      id: "status",
    }),
    lineColumns.display({
      cell: (info) => (
        <ReportLineMenu
          cohortId={cohortId}
          line={info.row.original}
          slug={slug}
        />
      ),
      id: "actions",
    }),
  ]);

  return (
    <>
      {header}
      <LayoutContent className="flex w-full flex-col gap-6 py-6">
        {failed ? <DataFailure onRetry={reloadPage} /> : null}
        {Arr.isReadonlyArrayEmpty(pagination.results) && !failed ? (
          <TableEmpty
            act="reading"
            description={t("students-empty-description")}
            title={t("students-empty")}
          />
        ) : null}
        {Arr.isReadonlyArrayNonEmpty(pagination.results) ? (
          <DataTable
            columns={columns}
            data={pagination.results}
            facets={[
              {
                column: "status",
                options: Arr.map(LINE_STATES, (state) => ({
                  label: t(`state-${state}`),
                  value: state,
                })),
                title: t("status"),
              },
            ]}
            rowId={(line) => line.student.id}
            search={{ column: "student", placeholder: t("search-students") }}
          />
        ) : null}
        {PaginatedQueryResult.isCanLoadMore(pagination) ? (
          <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
        ) : null}
      </LayoutContent>
    </>
  );
}

/**
 * The row menu of one student's report: write the note, hand in, or take back for the
 * homeroom teacher, approve for the principal, and open the PDF once it is locked. Each
 * item shows only when the server allows it.
 */
function ReportLineMenu({
  cohortId,
  line,
  slug,
}: {
  cohortId: Id<"tenantCohorts">;
  line: ReportLine;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolReports");
  const common = useTranslations("Common");
  const locale = useLocale();
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
  const [isWriting, setIsWriting] = useState(false);
  const { report } = line;
  const menu = menuOf(line);
  if (
    !(menu.write || menu.complete || menu.reopen || menu.approve || menu.open)
  ) {
    return null;
  }

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={common("more-actions")}
              size="icon-sm"
              variant="ghost"
            >
              <HugeIcons icon={MoreHorizontalIcon} />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-48">
          {menu.write ? (
            <DropdownMenuItem onClick={() => setIsWriting(true)}>
              <HugeIcons icon={PencilEdit02Icon} />
              {t("write")}
            </DropdownMenuItem>
          ) : null}
          {menu.complete && report !== null ? (
            <DropdownMenuItem
              onClick={() =>
                startTransition(() =>
                  saveSchool(
                    () => complete({ reportId: report.id, slug }),
                    SOURCE
                  )
                )
              }
            >
              <HugeIcons icon={SentIcon} />
              {t("complete")}
            </DropdownMenuItem>
          ) : null}
          {menu.reopen && report !== null ? (
            <DropdownMenuItem
              onClick={() =>
                startTransition(() =>
                  saveSchool(
                    () => reopen({ reportId: report.id, slug }),
                    SOURCE
                  )
                )
              }
            >
              <HugeIcons icon={ArrowTurnBackwardIcon} />
              {t("reopen")}
            </DropdownMenuItem>
          ) : null}
          {menu.approve && report !== null ? (
            <DropdownMenuItem
              onClick={() =>
                startTransition(() =>
                  saveSchool(
                    () => approve({ reportId: report.id, slug }),
                    SOURCE
                  )
                )
              }
            >
              <HugeIcons icon={CheckmarkCircle02Icon} />
              {t("approve")}
            </DropdownMenuItem>
          ) : null}
          {menu.open && report !== null ? (
            <ReportFileItem reportId={report.id} slug={slug} />
          ) : null}
          {menu.open && report !== null && report.hash !== null ? (
            <DropdownMenuItem
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
            />
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {menu.write ? (
        <ReportNoteDialog
          cohortId={cohortId}
          line={line}
          open={isWriting}
          setOpen={setIsWriting}
          slug={slug}
        />
      ) : null}
    </div>
  );
}

/** The item that opens a locked report's PDF. It reads the report when the menu opens. */
function ReportFileItem({
  reportId,
  slug,
}: {
  reportId: Id<"reportCards">;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolReports");
  const detail = useQuery(records.reports.get, { reportId, slug });
  const file = QueryResult.isSuccess(detail) ? detail.value.file : null;
  return (
    <DropdownMenuItem
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
function ReportNoteDialog({
  cohortId,
  line,
  open,
  setOpen,
  slug,
}: {
  cohortId: Id<"tenantCohorts">;
  line: ReportLine;
  open: boolean;
  setOpen: (open: boolean) => void;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolReports");
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
          value={note}
        />
      </Field>
    </ResponsiveDialog>
  );
}
