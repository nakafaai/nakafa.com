import type { Ref } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import {
  Calendar01Icon,
  Calendar03Icon,
  CalendarCheckIn01Icon,
  CalendarsIcon,
  MortarboardIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import records from "@repo/backend/confect/_generated/refs/records";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { DropdownMenuItem } from "@repo/design-system/components/ui/dropdown-menu";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { namedOptions } from "@/components/shared/table/filter";
import { TablePageBody } from "@/components/shared/table/frame";
import { RowItems } from "@/components/shared/table/menu";
import { TableTitle } from "@/components/shared/table/title";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { EmptyState } from "@/components/state/empty";
import { EmptyNina } from "@/components/state/nina";
import { SchoolHeader } from "@/components/tenant/header";
import { UNIT_ICONS } from "@/components/tenant/settings/choices";
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

/** The columns of the class group list. */
const cohortColumns = tableColumns<CohortItem>();

/**
 * The graduation of the school (ADR 0033, S6): the class groups of each unit's last grade in its
 * active period that the viewer opens, as the principal, the Admin, or Staff. Each opens its
 * students' transcript data and SKL.
 */
export function GraduationCohorts({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("SchoolGraduation");
  const tCommon = useTranslations("Common");
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
      header: tCommon("class-group"),
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
      header: tCommon("period"),
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
        <TableSearch placeholder={tCommon("search-class-groups")} />
      </SchoolHeader>
      <TablePageBody>
        {QueryResult.isSuccess(cohorts) && Arr.isReadonlyArrayEmpty(loaded) ? (
          <EmptyState
            description={t("cohorts-empty-description")}
            scene={<EmptyNina act="pointing" />}
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
    <RowItems>
      <DropdownMenuItem
        icon={MortarboardIcon}
        render={
          <Link
            params={{ cohortId, slug }}
            to="/school/$slug/graduation/$cohortId"
          />
        }
      >
        {common("open")}
      </DropdownMenuItem>
    </RowItems>
  );
}
