import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  usePaginatedQuery,
} from "@confect/react";
import { PauseCircleIcon, School01Icon } from "@hugeicons/core-free-icons";
import operators from "@repo/backend/confect/_generated/refs/operators";
import { TenantStatus } from "@repo/backend/confect/tenancy/schema";
import { Button } from "@repo/design-system/components/ui/button";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { OpenSchoolDialog } from "@/components/operators/open";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import { PageFrame } from "@/components/shared/content/frame";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { ColumnFilter } from "@/components/shared/table/column";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty, TablePageBody } from "@/components/shared/table/frame";
import { type StatusLook, TableStatus } from "@/components/shared/table/status";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { LoadFailure } from "@/components/state/failure";
import { HOME_TARGET } from "@/lib/routing/target";

/** How many schools one page of the list loads, and each page after it. */
const PAGE_SIZE = 50;

/** One school as the console lists it. */
type SchoolRow = PaginatedQueryItem<typeof operators.tenants.list>;

/** The columns of the schools table. */
const schoolColumns = createColumnHelper<typeof dataTableFeatures, SchoolRow>();

/** The look of each school status, in its cell and in its column's filter. */
const STATUS_LOOKS = {
  active: { icon: School01Icon, tone: "success" },
  suspended: { icon: PauseCircleIcon, tone: "neutral" },
} as const satisfies Record<typeof TenantStatus.Type, StatusLook>;

/**
 * The operator console: every school of this deployment, with Open school in the header.
 * It is the entry for a school that opens under a contract (K9); anyone else opens a school
 * at `/school/new`. An account that is no operator reads the refusal in the table's place.
 */
export function OperatorConsole() {
  const t = useTranslations("Operators");
  const common = useTranslations("Common");
  const [isOpening, setIsOpening] = useState(false);

  return (
    <PageFrame width="page">
      <TableFiltersProvider>
        <BreadcrumbHeader
          value={{
            action: (
              <>
                <TableSearch placeholder={t("search")} />
                <Button onClick={() => setIsOpening(true)} type="button">
                  {t("open")}
                </Button>
              </>
            ),
            home: HOME_TARGET,
            homeLabel: common("home"),
            items: [{ label: t("title") }],
            title: t("title"),
          }}
        />
        <TablePageBody>
          <OperatorSchools />
        </TablePageBody>
        <OpenSchoolDialog open={isOpening} setOpen={setIsOpening} />
      </TableFiltersProvider>
    </PageFrame>
  );
}

/**
 * The schools in a data table that filters by name and status and loads more rows as its
 * end comes into view. It waits for its first page, so no empty state shows before the rows.
 */
function OperatorSchools() {
  const t = useTranslations("Operators");
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const pagination = usePaginatedQuery(
    operators.tenants.list,
    isSettled ? {} : "skip",
    { initialNumItems: PAGE_SIZE }
  );

  const failed = PaginatedQueryResult.isFailure(pagination);
  if (pagination._tag === "LoadingFirstPage") {
    return null;
  }
  if (failed && pagination.error._tag === "NotOperator") {
    return (
      <TableEmpty
        act="typing"
        description={t("refused-description")}
        title={t("refused")}
      />
    );
  }
  if (Arr.isReadonlyArrayEmpty(pagination.results)) {
    if (failed) {
      return <LoadFailure onRetry={reloadPage} />;
    }
    return (
      <TableEmpty
        act="typing"
        description={t("open-description")}
        title={t("empty")}
      />
    );
  }

  const columns = schoolColumns.columns([
    schoolColumns.accessor((school) => school.name, {
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
      filterFn: "includesString",
      header: t("name"),
      id: "name",
      sortFn: "text",
    }),
    schoolColumns.accessor((school) => school.slug, {
      header: t("address"),
      id: "slug",
      sortFn: "text",
    }),
    schoolColumns.accessor((school) => t(`kind.${school.kind}`), {
      enableSorting: false,
      header: t("kind-label"),
      id: "kind",
    }),
    schoolColumns.accessor((school) => school.unitCount, {
      header: t("units"),
      id: "units",
      meta: { align: "end" },
    }),
    schoolColumns.accessor((school) => school.status, {
      cell: (info) => (
        <TableStatus
          icon={STATUS_LOOKS[info.getValue()].icon}
          label={t(`status.${info.getValue()}`)}
          tone={STATUS_LOOKS[info.getValue()].tone}
        />
      ),
      enableSorting: false,
      filterFn: "oneOf",
      header: () => (
        <ColumnFilter
          column="status"
          options={Arr.map(TenantStatus.literals, (status) => ({
            icon: STATUS_LOOKS[status].icon,
            label: t(`status.${status}`),
            value: status,
          }))}
          title={t("status-label")}
        />
      ),
      id: "status",
    }),
  ]);

  return (
    <>
      {failed ? <DataFailure onRetry={reloadPage} /> : null}
      <DataTable
        columns={columns}
        data={pagination.results}
        rowId={(school) => school.id}
        search="name"
      />
      {PaginatedQueryResult.isCanLoadMore(pagination) ? (
        <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
      ) : null}
    </>
  );
}
