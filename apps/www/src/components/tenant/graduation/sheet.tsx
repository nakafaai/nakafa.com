import type { Ref } from "@confect/core";
import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import {
  CheckmarkBadge01Icon,
  CircleIcon,
  Download04Icon,
  IdentityCardIcon,
  Loading03Icon,
  MoreHorizontalIcon,
  SquareLock02Icon,
  UserCheck01Icon,
  UserRemove01Icon,
} from "@hugeicons/core-free-icons";
import records from "@repo/backend/confect/_generated/refs/records";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr } from "effect";
import { useFormatter, useLocale, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { DataFailure } from "@/components/shared/failure";
import { PaneOpen } from "@/components/shared/pane";
import {
  Panes,
  PanesDetail,
  PanesList,
  PanesProvider,
} from "@/components/shared/panes";
import { reloadPage } from "@/components/shared/reload";
import { ColumnFilter } from "@/components/shared/table/column";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty } from "@/components/shared/table/frame";
import { type StatusLook, TableStatus } from "@/components/shared/table/status";
import { TableFiltersProvider } from "@/components/shared/table/toolbar";
import { GraduationLineDetail } from "@/components/tenant/graduation/detail";
import {
  CohortGraduationHeader,
  useCohortArgs,
} from "@/components/tenant/graduation/header";
import { checkAddress } from "@/components/tenant/reports/check";

/** One student of a graduating class group, as the page reads them. */
export type GraduationLine = Ref.Returns<
  typeof records.graduations.sheet
>["page"][number];

/** How many students one page of the list loads, and each page after it. */
const PAGE_SIZE = 50;

/** The state of a line's SKL with its icon, in the list, its filter, and the open student. */
const LETTER_ICONS = {
  issued: Loading03Icon,
  locked: SquareLock02Icon,
  none: CircleIcon,
};

/** The look of each readiness value: ready, or the fact that is missing, which reads as a warning. */
const READY_LOOKS = {
  decision: { icon: CheckmarkBadge01Icon, tone: "warning" },
  nisn: { icon: IdentityCardIcon, tone: "warning" },
  npsn: { icon: IdentityCardIcon, tone: "warning" },
  ready: { icon: UserCheck01Icon, tone: "success" },
  report: { icon: UserRemove01Icon, tone: "warning" },
} as const satisfies Record<
  GraduationLine["missing"][number] | "ready",
  StatusLook
>;

/** The readiness values of a line: what is missing, or ready when nothing is. */
const readinessOf = (line: GraduationLine) =>
  Arr.isReadonlyArrayEmpty(line.missing) ? ["ready" as const] : line.missing;

/** The state of a line's SKL: none yet, or the state it is in. */
const letterStateOf = (line: GraduationLine) => line.letter?.state ?? "none";

/** The sort value of a student without transcript data: below every average, which is 0 or more. */
const NO_AVERAGE = -1;

/** A line's transcript average, which its column sorts by. */
const averageOf = (line: GraduationLine) =>
  line.transcript?.average ?? NO_AVERAGE;

/** The columns of the graduation list. */
const lineColumns = createColumnHelper<
  typeof dataTableFeatures,
  GraduationLine
>();

/**
 * The graduation of one class group (ADR 0033, S6): each placed student with their transcript
 * average, whether a NISN is on file, their SKL, and what keeps them from it, beside the student
 * a press opens on a wide screen and in a sheet on a phone. The header holds the search, the
 * decision on graduation and the issue of the letters for the principal, and the e-Ijazah export.
 */
export function CohortGraduation() {
  return (
    <TableFiltersProvider>
      <PanesProvider>
        <CohortGraduationHeader />
        <div className="flex w-full min-w-0 flex-1 flex-col">
          <CohortGraduationBody />
        </div>
      </PanesProvider>
    </TableFiltersProvider>
  );
}

/** The students of the class group, read a page at a time, beside the open student; or the empty state. */
function CohortGraduationBody() {
  const t = useTranslations("SchoolGraduation");
  const format = useFormatter();
  const args = useCohortArgs();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const pagination = usePaginatedQuery(
    records.graduations.sheet,
    isSettled ? args : "skip",
    { initialNumItems: PAGE_SIZE }
  );

  if (pagination._tag === "LoadingFirstPage") {
    return null;
  }
  const failed = PaginatedQueryResult.isFailure(pagination);
  if (Arr.isReadonlyArrayEmpty(pagination.results)) {
    return failed ? (
      <DataFailure onRetry={reloadPage} />
    ) : (
      <TableEmpty
        act="reading"
        description={t("students-empty-description")}
        title={t("students-empty")}
      />
    );
  }
  const twoDecimals = (value: number) =>
    format.number(value, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });

  const columns = lineColumns.columns([
    lineColumns.accessor((line) => line.student.name, {
      cell: (info) => (
        <PaneOpen id={info.row.original.student.id}>{info.getValue()}</PaneOpen>
      ),
      filterFn: "includesString",
      header: t("student"),
      id: "student",
      sortFn: "text",
    }),
    lineColumns.accessor((line) => (line.hasNisn ? "yes" : "no"), {
      cell: (info) => t(`nisn-${info.getValue()}`),
      enableSorting: false,
      filterFn: "oneOf",
      header: () => (
        <ColumnFilter
          column="nisn"
          options={Arr.map(["yes", "no"] as const, (value) => ({
            icon: value === "yes" ? UserCheck01Icon : IdentityCardIcon,
            label: t(`nisn-${value}`),
            value,
          }))}
          title={t("nisn")}
        />
      ),
      id: "nisn",
    }),
    lineColumns.accessor(averageOf, {
      cell: (info) =>
        info.getValue() === NO_AVERAGE ? (
          <span className="text-muted-foreground">{t("average-none")}</span>
        ) : (
          <span className="tabular-nums">{twoDecimals(info.getValue())}</span>
        ),
      header: t("average"),
      id: "average",
      sortFn: "basic",
    }),
    lineColumns.accessor(letterStateOf, {
      cell: (info) => (
        <span className="flex items-center gap-2">
          <HugeIcons icon={LETTER_ICONS[info.getValue()]} />
          {t(`letter-${info.getValue()}`)}
        </span>
      ),
      enableSorting: false,
      filterFn: "oneOf",
      header: () => (
        <ColumnFilter
          column="letter"
          options={Arr.map(["none", "issued", "locked"] as const, (state) => ({
            icon: LETTER_ICONS[state],
            label: t(`letter-${state}`),
            value: state,
          }))}
          title={t("letter")}
        />
      ),
      id: "letter",
    }),
    lineColumns.accessor(readinessOf, {
      cell: (info) => (
        <span className="flex flex-wrap gap-1">
          {Arr.map(info.getValue(), (value) => (
            <TableStatus
              icon={READY_LOOKS[value].icon}
              key={value}
              label={t(`ready-${value}`)}
              tone={READY_LOOKS[value].tone}
            />
          ))}
        </span>
      ),
      enableSorting: false,
      filterFn: "anyOf",
      header: () => (
        <ColumnFilter
          column="ready"
          options={Arr.map(
            ["ready", "npsn", "decision", "nisn", "report"] as const,
            (value) => ({
              icon: READY_LOOKS[value].icon,
              label: t(`ready-${value}`),
              value,
            })
          )}
          title={t("ready")}
        />
      ),
      id: "ready",
    }),
    lineColumns.display({
      cell: (info) => <GraduationLineMenu line={info.row.original} />,
      id: "actions",
      meta: { align: "menu" },
    }),
  ]);

  return (
    <Panes>
      <PanesList>
        {failed ? <DataFailure onRetry={reloadPage} /> : null}
        <DataTable
          columns={columns}
          data={pagination.results}
          rowId={(line) => line.student.id}
          search="student"
        />
        {PaginatedQueryResult.isCanLoadMore(pagination) ? (
          <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
        ) : null}
      </PanesList>
      <PanesDetail empty={t("detail-empty")} label={t("detail")}>
        <GraduationLineDetail lines={pagination.results} />
      </PanesDetail>
    </Panes>
  );
}

/** The row menu of one student: open the SKL's PDF and its check page, once it is locked. */
function GraduationLineMenu({ line }: { line: GraduationLine }) {
  const t = useTranslations("SchoolGraduation");
  const common = useTranslations("Common");
  const locale = useLocale();

  if (line.letter === null || line.letter.file === null) {
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
          <DropdownMenuItem
            render={
              <a href={line.letter.file} rel="noopener" target="_blank">
                <HugeIcons icon={Download04Icon} />
                {t("open-letter")}
              </a>
            }
          />
          <DropdownMenuItem
            render={
              <a
                href={checkAddress(locale, line.letter.hash)}
                rel="noopener"
                target="_blank"
              >
                <HugeIcons icon={CheckmarkBadge01Icon} />
                {t("open-check")}
              </a>
            }
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
