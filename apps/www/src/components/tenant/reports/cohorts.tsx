import type { Ref } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import records from "@repo/backend/confect/_generated/refs/records";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr } from "effect";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { LayoutContent } from "@/components/shared/content/frame";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty } from "@/components/shared/table/frame";
import { SchoolHeader } from "@/components/tenant/header";
import { Link } from "@/lib/routing/link";

/** One class group whose report cards the viewer opens. */
type CohortItem = Ref.Returns<typeof records.reports.cohorts>[number];

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
      header: t("period"),
      id: "period",
      sortFn: "text",
    }),
  ]);

  return (
    <>
      <SchoolHeader items={[{ label: t("title") }]} title={t("title")} />
      <LayoutContent className="flex w-full flex-col gap-6 py-6">
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
            search={{ column: "cohort", placeholder: t("search-cohorts") }}
          />
        ) : null}
      </LayoutContent>
    </>
  );
}
