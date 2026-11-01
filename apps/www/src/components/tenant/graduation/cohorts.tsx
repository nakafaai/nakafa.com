import type { Ref } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import {
  Building03Icon,
  Calendar01Icon,
  Calendar03Icon,
  CalendarCheckIn01Icon,
  CalendarsIcon,
  MoreHorizontalIcon,
  MortarboardIcon,
  School01Icon,
  SchoolIcon,
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
import { Link } from "@/lib/routing/link";

/** One graduating class group the viewer opens. */
type CohortItem = Ref.Returns<typeof records.graduations.cohorts>[number];

/** The icons of the periods in the period filter, one calendar for each. */
const PERIOD_ICONS = [
  Calendar03Icon,
  Calendar01Icon,
  CalendarCheckIn01Icon,
  CalendarsIcon,
] as const;

/** The icons of the units in the unit filter, one building for each. */
const UNIT_ICONS = [School01Icon, SchoolIcon, Building03Icon] as const;

/** The columns of the class group list. */
const cohortColumns = tableColumns<CohortItem>();

/**
 * The graduation of the school (ADR 0033, S6): the class groups of each unit's last grade in its
 * active period that the viewer opens, as the principal, the Admin, or Staff. Each opens its
 * students' transcript data and SKL.
 */
export function GraduationCohorts({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("SchoolGraduation");
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const cohorts = useQuery(
    records.graduations.cohorts,
    isSettled ? { slug } : "skip"
  );
  if (QueryResult.isFailure(cohorts)) {
    throw cohorts.error;
  }
  const loaded = QueryResult.isSuccess(cohorts) ? cohorts.value : [];

  const columns = [
    cohortColumns.text((cohort) => cohort.name, {
      cell: (info) => (
        <TableTitle icon={UserGroupIcon}>
          <Link
            className="hover:underline"
            params={{ cohortId: info.row.original.id, slug }}
            to="/school/$slug/graduation/$cohortId"
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
        Arr.dedupe(Arr.map(loaded, (cohort) => cohort.unit)),
        UNIT_ICONS
      ),
    }),
    cohortColumns.values((cohort) => cohort.period, {
      header: t("period"),
      id: "period",
      options: namedOptions(
        Arr.dedupe(Arr.map(loaded, (cohort) => cohort.period)),
        PERIOD_ICONS
      ),
    }),
    cohortColumns.menu((info) => (
      <GraduationCohortMenu cohortId={info.row.original.id} slug={slug} />
    )),
  ];

  return (
    <TableFiltersProvider>
      <SchoolHeader items={[{ label: t("title") }]} title={t("title")}>
        <TableSearch placeholder={t("search-cohorts")} />
      </SchoolHeader>
      <TablePageBody>
        {QueryResult.isSuccess(cohorts) && Arr.isReadonlyArrayEmpty(loaded) ? (
          <TableEmpty
            act="pointing"
            description={t("cohorts-empty-description")}
            title={t("cohorts-empty")}
          />
        ) : null}
        {Arr.isReadonlyArrayNonEmpty(loaded) ? (
          <DataTable
            columns={columns}
            data={loaded}
            rowId={(cohort) => cohort.id}
            search="cohort"
          />
        ) : null}
      </TablePageBody>
    </TableFiltersProvider>
  );
}

/** The row menu of one class group: Open, to its students' transcript data and SKL. */
function GraduationCohortMenu({
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
                  to="/school/$slug/graduation/$cohortId"
                >
                  <HugeIcons icon={MortarboardIcon} />
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
