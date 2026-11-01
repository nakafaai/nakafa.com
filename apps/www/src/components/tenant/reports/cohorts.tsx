import type { Ref } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import {
  Calendar01Icon,
  Calendar03Icon,
  CalendarCheckIn01Icon,
  CalendarsIcon,
  Certificate01Icon,
  MoreHorizontalIcon,
  UserGroupIcon,
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
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { namedOptions } from "@/components/shared/table/filter";
import { TableEmpty, TablePageBody } from "@/components/shared/table/frame";
import { TableTitle } from "@/components/shared/table/title";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { SchoolHeader } from "@/components/tenant/header";
import { UNIT_ICONS } from "@/components/tenant/settings/choices";
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
const cohortColumns = tableColumns<CohortItem>();

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

  const columns = [
    cohortColumns.text((cohort) => cohort.name, {
      cell: (info) => (
        <TableTitle icon={UserGroupIcon}>
          <Link
            className="hover:underline"
            params={{ cohortId: info.row.original.id, slug }}
            to="/school/$slug/reports/$cohortId"
          >
            {info.getValue()}
          </Link>
        </TableTitle>
      ),
      header: t("cohort"),
      id: "cohort",
    }),
    cohortColumns.values((cohort) => cohort.unit, {
      header: t("unit"),
      id: "unit",
      options: namedOptions(
        Arr.dedupe(
          Arr.map(
            QueryResult.isSuccess(cohorts) ? cohorts.value : [],
            (cohort) => cohort.unit
          )
        ),
        UNIT_ICONS
      ),
    }),
    cohortColumns.values((cohort) => cohort.period, {
      header: t("period"),
      id: "period",
      options: namedOptions(
        Arr.dedupe(
          Arr.map(
            QueryResult.isSuccess(cohorts) ? cohorts.value : [],
            (cohort) => cohort.period
          )
        ),
        PERIOD_ICONS
      ),
    }),
    cohortColumns.menu((info) => (
      <ReportCohortMenu cohortId={info.row.original.id} slug={slug} />
    )),
  ];

  return (
    <TableFiltersProvider>
      <SchoolHeader items={[{ label: t("title") }]} title={t("title")}>
        <TableSearch placeholder={t("search-cohorts")} />
      </SchoolHeader>
      <TablePageBody>
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
      </TablePageBody>
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
