import { QueryResult, usePaginatedQuery, useQuery } from "@confect/react";
import {
  ArrowTurnBackwardIcon,
  CheckmarkBadge01Icon,
  CheckmarkCircle02Icon,
  CircleIcon,
  Edit02Icon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
  SentIcon,
  SquareLock02Icon,
} from "@hugeicons/core-free-icons";
import records from "@repo/backend/confect/_generated/refs/records";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { getRouteApi } from "@tanstack/react-router";
import { Array as Arr, Record as Rec } from "effect";
import { useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { PaneOpen } from "@/components/shared/pane";
import {
  Panes,
  PanesDetail,
  PanesList,
  PanesProvider,
} from "@/components/shared/panes";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { TableEmpty } from "@/components/shared/table/frame";
import { TablePages } from "@/components/shared/table/pages";
import { type StatusLook, TableStatus } from "@/components/shared/table/status";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { useTenant } from "@/components/tenant/context";
import { SchoolHeader } from "@/components/tenant/header";
import { menuOf } from "@/components/tenant/reports/access";
import { useReportActions } from "@/components/tenant/reports/actions";
import type { ReportLine } from "@/components/tenant/reports/change";
import { checkAddress } from "@/components/tenant/reports/check";
import {
  ReportLineDetail,
  ReportNoteDialog,
} from "@/components/tenant/reports/detail";
import { LOCALE_ROUTE } from "@/lib/routing/tree";

/** How many students one page of the list loads, and each page after it. */
const PAGE_SIZE = 50;

/** The route of one class group's report cards, whose context holds the class group's ID. */
const cohortRoute = getRouteApi("/school/$slug/reports/$cohortId");

/** The school and the class group of the page, which every read and write names. */
function useCohortArgs() {
  const { slug } = useTenant();
  const cohortId = cohortRoute.useRouteContext({
    select: (context) => context.cohortId,
  });
  return { cohortId, slug };
}

/** The columns of the report list. */
const lineColumns = tableColumns<ReportLine>();

/** The state of a line's report: not started, or the state the report is in. */
const stateOf = (line: ReportLine) => line.report?.state ?? "none";

/** The state of each line's report, with its look, in the list and its filter. */
const STATE_LOOKS = {
  approved: { icon: CheckmarkBadge01Icon, tone: "success" },
  completed: { icon: SentIcon, tone: "info" },
  draft: { icon: Edit02Icon, tone: "info" },
  locked: { icon: SquareLock02Icon, tone: "success" },
  none: { icon: CircleIcon, tone: "neutral" },
} as const satisfies Record<ReturnType<typeof stateOf>, StatusLook>;

/**
 * The report cards of one class group (ADR 0033, S4): each placed student with the state
 * of their report, beside the report a press opens on a wide screen and in a sheet on a
 * phone. The header holds the search by student and the state filter. The homeroom teacher
 * writes a note and hands a report in, or takes it back; the principal approves it, which
 * draws its PDF and locks it. A locked report opens its PDF and its public check page.
 */
export function CohortReports() {
  return (
    <TableFiltersProvider>
      <PanesProvider>
        <CohortReportsHeader />
        <div className="flex w-full min-w-0 flex-1 flex-col">
          <CohortReportsBody />
        </div>
      </PanesProvider>
    </TableFiltersProvider>
  );
}

/** The page's header: the path back to the report cards and the class group's name, then the search; the status column filters the students by state. */
function CohortReportsHeader() {
  const t = useTranslations("SchoolReports");
  const args = useCohortArgs();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const cohort = useQuery(tenancy.cohorts.get, isSettled ? args : "skip");
  const title = QueryResult.isSuccess(cohort) ? cohort.value.name : undefined;

  return (
    <SchoolHeader
      items={[
        {
          label: t("title"),
          target: {
            from: LOCALE_ROUTE,
            params: { slug: args.slug },
            to: "/school/$slug/reports",
          },
        },
        ...(title === undefined ? [] : [{ label: title }]),
      ]}
      {...(title === undefined ? {} : { title })}
    >
      <TableSearch placeholder={t("search-students")} />
    </SchoolHeader>
  );
}

/** The students of the class group, read a page at a time, beside the open report; or the empty state. */
function CohortReportsBody() {
  const t = useTranslations("SchoolReports");
  const args = useCohortArgs();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const pagination = usePaginatedQuery(
    records.reports.sheet,
    isSettled ? args : "skip",
    { initialNumItems: PAGE_SIZE }
  );

  const columns = [
    lineColumns.text((line) => line.student.name, {
      cell: (info) => (
        <PaneOpen id={info.row.original.student.id}>{info.getValue()}</PaneOpen>
      ),
      header: t("student"),
      id: "student",
    }),
    lineColumns.values(stateOf, {
      cell: (info) => (
        <TableStatus
          {...STATE_LOOKS[info.getValue()]}
          label={t(`state-${info.getValue()}`)}
        />
      ),
      header: t("status"),
      id: "status",
      options: Arr.map(
        ["none", "draft", "completed", "approved", "locked"] as const,
        (state) => ({
          icon: STATE_LOOKS[state].icon,
          label: t(`state-${state}`),
          value: state,
        })
      ),
    }),
    lineColumns.menu((info) => <ReportLineMenu line={info.row.original} />),
  ];

  return (
    <Panes>
      <PanesList>
        <TablePages pageSize={PAGE_SIZE} pagination={pagination}>
          <DataTable
            columns={columns}
            data={pagination.results}
            empty={
              <TableEmpty
                act="reading"
                description={t("students-empty-description")}
                title={t("students-empty")}
              />
            }
            rowId={(line) => line.student.id}
            search="student"
          />
        </TablePages>
      </PanesList>
      <PanesDetail label={t("detail")}>
        <ReportLineDetail lines={pagination.results} />
      </PanesDetail>
    </Panes>
  );
}

/**
 * The row menu of one student's report: write the note, hand in, or take back for the
 * homeroom teacher, approve for the principal, and open the check page once it is locked.
 * Each item shows only when the server allows it.
 */
function ReportLineMenu({ line }: { line: ReportLine }) {
  const t = useTranslations("SchoolReports");
  const common = useTranslations("Common");
  const [isWriting, setIsWriting] = useState(false);
  const menu = menuOf(line);

  if (!Rec.some(menu, (shown) => shown)) {
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
          {line.report === null ? null : (
            <ReportStateItems menu={menu} report={line.report} />
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {menu.write ? (
        <ReportNoteDialog line={line} open={isWriting} setOpen={setIsWriting} />
      ) : null}
    </div>
  );
}

/**
 * The row menu's items on a report that exists: hand in a draft, take back or approve a
 * handed-in report, and open the check page of a locked one.
 */
function ReportStateItems({
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
      {menu.complete ? (
        <DropdownMenuItem onClick={() => actions.complete(report.id)}>
          <HugeIcons icon={SentIcon} />
          {t("complete")}
        </DropdownMenuItem>
      ) : null}
      {menu.reopen ? (
        <DropdownMenuItem onClick={() => actions.reopen(report.id)}>
          <HugeIcons icon={ArrowTurnBackwardIcon} />
          {t("reopen")}
        </DropdownMenuItem>
      ) : null}
      {menu.approve ? (
        <DropdownMenuItem onClick={() => actions.approve(report.id)}>
          <HugeIcons icon={CheckmarkCircle02Icon} />
          {t("approve")}
        </DropdownMenuItem>
      ) : null}
      {menu.open && report.hash !== null ? (
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
    </>
  );
}
