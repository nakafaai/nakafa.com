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
import { Array as Arr } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { OpenSchoolDialog } from "@/components/operators/open";
import { BreadcrumbHeader } from "@/components/shared/breadcrumb/header";
import { PageFrame } from "@/components/shared/content/frame";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { namedOptions } from "@/components/shared/table/filter";
import { TableEmpty, TablePageBody } from "@/components/shared/table/frame";
import { type StatusLook, TableStatus } from "@/components/shared/table/status";
import { TableTitle } from "@/components/shared/table/title";
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
const schoolColumns = tableColumns<SchoolRow>();

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

  const columns = [
    schoolColumns.text((school) => school.name, {
      cell: (info) => (
        <TableTitle
          icon={School01Icon}
          tone={STATUS_LOOKS[info.row.original.status].tone}
        >
          {info.getValue()}
        </TableTitle>
      ),
      header: t("name"),
      id: "name",
    }),
    schoolColumns.text((school) => school.slug, {
      header: t("address"),
      id: "slug",
    }),
    schoolColumns.values((school) => t(`kind.${school.kind}`), {
      header: t("kind-label"),
      id: "kind",
      options: namedOptions(
        Arr.dedupe(
          Arr.map(pagination.results, (school) => t(`kind.${school.kind}`))
        ),
        [School01Icon]
      ),
    }),
    schoolColumns.number((school) => school.unitCount, {
      align: "end",
      header: t("units"),
      id: "units",
    }),
    schoolColumns.values((school) => school.status, {
      cell: (info) => (
        <TableStatus
          icon={STATUS_LOOKS[info.getValue()].icon}
          label={t(`status.${info.getValue()}`)}
          tone={STATUS_LOOKS[info.getValue()].tone}
        />
      ),
      header: t("status-label"),
      id: "status",
      options: Arr.map(TenantStatus.literals, (status) => ({
        icon: STATUS_LOOKS[status].icon,
        label: t(`status.${status}`),
        value: status,
      })),
    }),
  ];

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
