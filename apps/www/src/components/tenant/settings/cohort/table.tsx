import { QueryResult, useQuery } from "@confect/react";
import { UserGroupIcon } from "@hugeicons/core-free-icons";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { CohortStatus } from "@repo/backend/confect/tenancy/cohort";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, Order } from "effect";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { namedOptions } from "@/components/shared/table/filter";
import { RowCopy } from "@/components/shared/table/menu";
import { TableStatus } from "@/components/shared/table/status";
import { TableTitle } from "@/components/shared/table/title";
import { EmptyState } from "@/components/state/empty";
import { EmptyNina } from "@/components/state/nina";
import { WithAction } from "@/components/tenant/action";
import { GRADE_ICONS } from "@/components/tenant/settings/choices";
import { CohortOverviewContext } from "@/components/tenant/settings/cohort/holds";
import {
  SchoolCohortMenu,
  SchoolCohortRestore,
} from "@/components/tenant/settings/cohort/menu";
import type { CohortRow } from "@/components/tenant/settings/cohort/rows";
import { cohortRows } from "@/components/tenant/settings/cohort/rows";
import { COHORT_STATUS_LOOKS } from "@/components/tenant/settings/cohort/status";
import type { Period } from "@/components/tenant/settings/state";
import { isDraft } from "@/components/tenant/settings/state";
import { Link } from "@/lib/routing/link";

/** The columns of the cohorts table. */
const cohortColumns = tableColumns<CohortRow>();

/**
 * Renders the cohorts of one period in a data table that finds a name, filters by grade
 * and status, and sorts, with each cohort's row menu. The table waits for its list, so no
 * empty state shows before the rows arrive, and a period with no cohort shows the empty state.
 */
export function SchoolCohortTable({
  periodId,
  slug,
}: {
  periodId: Period["id"];
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const tCommon = useTranslations("Common");
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const cohorts = useQuery(
    tenancy.cohorts.list,
    isSettled ? { periodId, slug } : "skip"
  );
  const overview = useQuery(
    tenancy.cohorts.overview,
    isSettled ? { periodId, slug } : "skip"
  );
  if (QueryResult.isFailure(cohorts)) {
    throw cohorts.error;
  }
  if (!QueryResult.isSuccess(cohorts)) {
    return null;
  }
  if (Arr.isReadonlyArrayEmpty(cohorts.value)) {
    return (
      <EmptyState
        description={t("cohorts-description")}
        scene={<EmptyNina act="ruling" />}
        title={t("cohorts-empty")}
      />
    );
  }

  const columns = [
    cohortColumns.text((cohort) => cohort.name, {
      cell: (info) => (
        <TableTitle icon={UserGroupIcon}>
          <Link
            params={{ cohort: info.row.original.id, slug }}
            to="/school/$slug/settings/cohorts/$cohort"
          >
            {info.getValue()}
          </Link>
        </TableTitle>
      ),
      header: tCommon("name"),
      id: "name",
    }),
    cohortColumns.values((cohort) => String(cohort.grade), {
      header: t("cohort-grade"),
      id: "grade",
      options: namedOptions(
        Arr.map(
          Arr.sort(
            Arr.dedupe(Arr.map(cohorts.value, (cohort) => cohort.grade)),
            Order.Number
          ),
          String
        ),
        GRADE_ICONS
      ),
    }),
    cohortColumns.text((cohort) => cohort.homeroom, {
      header: t("cohort-homeroom"),
      id: "homeroom",
    }),
    cohortColumns.number((cohort) => cohort.students, {
      header: tCommon("students"),
      id: "students",
    }),
    cohortColumns.number((cohort) => cohort.classes, {
      header: tCommon("classes"),
      id: "classes",
    }),
    cohortColumns.values((cohort) => cohort.status, {
      cell: (info) => (
        <TableStatus
          icon={COHORT_STATUS_LOOKS[info.getValue()].icon}
          label={t(`cohort.${info.getValue()}`)}
          tone={COHORT_STATUS_LOOKS[info.getValue()].tone}
        />
      ),
      header: tCommon("state"),
      id: "status",
      options: Arr.map(CohortStatus.literals, (status) => ({
        icon: COHORT_STATUS_LOOKS[status].icon,
        label: t(`cohort.${status}`),
        value: status,
      })),
    }),
    cohortColumns.menu(
      (info) => (
        <WithAction
          action="cohort.manage"
          otherwise={<RowCopy value={info.row.original.name} />}
        >
          {info.row.original.status === "archived" ? (
            <SchoolCohortRestore cohort={info.row.original} slug={slug} />
          ) : (
            <SchoolCohortMenu cohort={info.row.original} slug={slug} />
          )}
        </WithAction>
      ),
      { inert: (row) => isDraft(row.id) }
    ),
  ];

  const read = QueryResult.isSuccess(overview) ? overview.value : null;
  return (
    <CohortOverviewContext value={read}>
      <DataTable
        columns={columns}
        data={cohortRows(cohorts.value, read)}
        rowId={(cohort) => cohort.id}
        search="name"
      />
    </CohortOverviewContext>
  );
}
