import { QueryResult, usePaginatedQuery, useQuery } from "@confect/react";
import {
  ArrowTurnBackwardIcon,
  CheckmarkBadge01Icon,
  CheckmarkCircle02Icon,
  CircleIcon,
  Edit02Icon,
  PencilEdit02Icon,
  RefreshIcon,
  SentIcon,
  SquareLock02Icon,
} from "@hugeicons/core-free-icons";
import records from "@repo/backend/confect/_generated/refs/records";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { DropdownMenuItem } from "@repo/design-system/components/ui/dropdown-menu";
import { getRouteApi } from "@tanstack/react-router";
import { Array as Arr, Option, Record as Rec } from "effect";
import { useState } from "react";
import { useLocale, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { PageList } from "@/components/shared/page/body";
import { Page } from "@/components/shared/page/frame";
import { PaneOpen } from "@/components/shared/page/pane";
import {
  PagePane,
  Panes,
  PanesList,
  PanesProvider,
} from "@/components/shared/page/panes";
import { useFormatTimeZone } from "@/components/shared/table/calendar";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { RowCopy, RowItems } from "@/components/shared/table/menu";
import { TablePages } from "@/components/shared/table/pages";
import { type StatusLook, TableStatus } from "@/components/shared/table/status";
import { TableText } from "@/components/shared/table/text";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { EmptyState } from "@/components/state/empty";
import { EmptyNina } from "@/components/state/nina";
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
import {
  SchoolDateTime,
  useSchoolTimeZone,
} from "@/components/tenant/settings/time";
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
        <Page height="screen">
          <CohortReportsHeader />
          <CohortReportsBody />
        </Page>
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
  const formatZone = useFormatTimeZone();
  const timeZone = useSchoolTimeZone();
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
    lineColumns.text((line) => line.student.email ?? "", {
      cell: (info) => <TableText>{info.getValue()}</TableText>,
      header: t("email"),
      id: "email",
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
    lineColumns.days((line) => line.report?.approvedAt ?? null, {
      cell: (info) => {
        const at = info.getValue();
        return at === null ? null : <SchoolDateTime at={at} />;
      },
      header: t("approved-at"),
      id: "approved",
      timeZone: () => Option.getOrElse(timeZone, formatZone),
    }),
    lineColumns.menu((info) => <ReportLineMenu line={info.row.original} />),
  ];

  return (
    <Panes id="reports">
      <PanesList>
        <PageList>
          <TablePages pageSize={PAGE_SIZE} pagination={pagination}>
            <DataTable
              columns={columns}
              data={pagination.results}
              empty={<ReportStudentsEmpty />}
              rowId={(line) => line.student.id}
              search="student"
            />
          </TablePages>
        </PageList>
      </PanesList>
      <PagePane label={t("detail")}>
        <ReportLineDetail lines={pagination.results} />
      </PagePane>
    </Panes>
  );
}

/** The report cards table with no student yet, under its column heads. */
function ReportStudentsEmpty() {
  const t = useTranslations("SchoolReports");

  return (
    <EmptyState
      description={t("students-empty-description")}
      scene={<EmptyNina act="reading" />}
      title={t("students-empty")}
    />
  );
}

/**
 * The row menu of one student's report: write the note, hand in, or take back for the
 * homeroom teacher, approve for the principal, and open the check page once it is locked.
 * Each item shows only when the server allows it.
 */
function ReportLineMenu({ line }: { line: ReportLine }) {
  const t = useTranslations("SchoolReports");
  const [isWriting, setIsWriting] = useState(false);
  const menu = menuOf(line);

  if (!Rec.some(menu, (shown) => shown)) {
    return <RowCopy value={line.student.name} />;
  }

  return (
    <>
      <RowItems>
        {menu.write ? (
          <DropdownMenuItem
            icon={PencilEdit02Icon}
            onClick={() => setIsWriting(true)}
          >
            {t("write")}
          </DropdownMenuItem>
        ) : null}
        {line.report === null ? null : (
          <ReportStateItems menu={menu} report={line.report} />
        )}
      </RowItems>
      {menu.write ? (
        <ReportNoteDialog line={line} open={isWriting} setOpen={setIsWriting} />
      ) : null}
    </>
  );
}

/**
 * The row menu's items on a report that exists: hand in a draft, take back or approve a
 * handed-in report, lock again one whose PDF has not arrived, and open the check page of a locked one.
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
  const check = report.hash === null ? null : checkAddress(locale, report.hash);

  return (
    <>
      {menu.complete ? (
        <DropdownMenuItem
          icon={SentIcon}
          onClick={() => actions.complete(report.id)}
        >
          {t("complete")}
        </DropdownMenuItem>
      ) : null}
      {menu.reopen ? (
        <DropdownMenuItem
          icon={ArrowTurnBackwardIcon}
          onClick={() => actions.reopen(report.id)}
        >
          {t("reopen")}
        </DropdownMenuItem>
      ) : null}
      {menu.approve ? (
        <DropdownMenuItem
          icon={CheckmarkCircle02Icon}
          onClick={() => actions.approve(report.id)}
        >
          {t("approve")}
        </DropdownMenuItem>
      ) : null}
      {menu.lock ? (
        <DropdownMenuItem
          icon={RefreshIcon}
          onClick={() => actions.approve(report.id)}
        >
          {t("lock-again")}
        </DropdownMenuItem>
      ) : null}
      {menu.open && check !== null ? (
        <DropdownMenuItem
          icon={CheckmarkBadge01Icon}
          render={({ children, ...props }) => (
            <a {...props} href={check} rel="noopener" target="_blank">
              {children}
            </a>
          )}
        >
          {t("open-check")}
        </DropdownMenuItem>
      ) : null}
    </>
  );
}
