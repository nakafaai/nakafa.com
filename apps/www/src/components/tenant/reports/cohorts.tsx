import type { Ref } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import {
  Calendar01Icon,
  Calendar03Icon,
  CalendarCheckIn01Icon,
  CalendarsIcon,
  Certificate01Icon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import records from "@repo/backend/confect/_generated/refs/records";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { ColumnFilter } from "@/components/shared/table/column";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { namedOptions } from "@/components/shared/table/filter";
import { TableEmpty } from "@/components/shared/table/frame";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { SchoolHeader } from "@/components/tenant/header";
import { Link } from "@/lib/routing/link";

/** One class group whose report cards the viewer opens. */
type CohortItem = Ref.Returns<typeof records.reports.cohorts>[number];

/** The icons of the periods in the period filter, one calendar for each. */
const PERIOD_ICONS = [
  Calendar03Icon,
  Calendar01Icon,
  CalendarCheckIn01Icon,
  CalendarsIcon,
] as const;

/** The columns of the class group list. */
const cohortColumns = createColumnHelper<
  typeof dataTableFeatures,
  CohortItem
>();

/**
 * The report cards of the school (ADR 0033, S4): the class groups whose reports the viewer
 * opens, as their homeroom teacher, the principal, or the Admin. Each opens its students'
 * report cards.
 */
export function ReportCohorts({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("SchoolReports");
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const cohorts = useQuery(
    records.reports.cohorts,
    isSettled ? { slug } : "skip"
  );
  if (QueryResult.isFailure(cohorts)) {
    throw cohorts.error;
  }

  const columns = cohortColumns.columns([
    cohortColumns.accessor((cohort) => cohort.name, {
      cell: (info) => (
        <Link
          className="font-medium hover:underline"
          params={{ cohortId: info.row.original.id, slug }}
          to="/school/$slug/reports/$cohortId"
        >
          {info.getValue()}
        </Link>
      ),
      filterFn: "includesString",
      header: t("cohort"),
      id: "cohort",
      sortFn: "text",
    }),
    cohortColumns.accessor((cohort) => cohort.period, {
      enableSorting: false,
      filterFn: "oneOf",
      header: () => (
        <ColumnFilter
          column="period"
          options={namedOptions(
            Arr.dedupe(
              Arr.map(
                QueryResult.isSuccess(cohorts) ? cohorts.value : [],
                (cohort) => cohort.period
              )
            ),
            PERIOD_ICONS
          )}
          title={t("period")}
        />
      ),
      id: "period",
    }),
    cohortColumns.display({
      cell: (info) => (
        <ReportCohortMenu cohortId={info.row.original.id} slug={slug} />
      ),
      id: "actions",
      meta: { align: "menu" },
    }),
  ]);

  return (
    <TableFiltersProvider>
      <SchoolHeader items={[{ label: t("title") }]} title={t("title")}>
        <TableSearch placeholder={t("search-cohorts")} />
      </SchoolHeader>
      <div className="flex w-full min-w-0 flex-1 flex-col">
        {QueryResult.isSuccess(cohorts) &&
        Arr.isReadonlyArrayEmpty(cohorts.value) ? (
          <TableEmpty
            act="pointing"
            description={t("cohorts-empty-description")}
            title={t("cohorts-empty")}
          />
        ) : null}
        {QueryResult.isSuccess(cohorts) &&
        Arr.isReadonlyArrayNonEmpty(cohorts.value) ? (
          <DataTable
            columns={columns}
            data={cohorts.value}
            rowId={(cohort) => cohort.id}
            search="cohort"
          />
        ) : null}
      </div>
    </TableFiltersProvider>
  );
}

/** The row menu of one class group: Open, to its students' report cards. */
function ReportCohortMenu({
  cohortId,
  slug,
}: {
  cohortId: CohortItem["id"];
  slug: TenantSlug;
}) {
  const common = useTranslations("Common");

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
          <DropdownMenuGroup>
            <DropdownMenuItem
              render={
                <Link
                  params={{ cohortId, slug }}
                  to="/school/$slug/reports/$cohortId"
                >
                  <HugeIcons icon={Certificate01Icon} />
                  {common("open")}
                </Link>
              }
            />
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
