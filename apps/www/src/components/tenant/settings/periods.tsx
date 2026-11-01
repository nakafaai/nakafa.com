import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  QueryResult,
  useMutation,
  usePaginatedQuery,
} from "@confect/react";
import {
  Archive02Icon,
  Calendar03Icon,
  CalendarCheckIn01Icon,
} from "@hugeicons/core-free-icons";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { PeriodStatus } from "@repo/backend/confect/tenancy/period";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr, DateTime, Option } from "effect";
import { startTransition, useState } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { ColumnFilter } from "@/components/shared/table/column";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty } from "@/components/shared/table/frame";
import { type StatusLook, TableStatus } from "@/components/shared/table/status";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { LoadFailure } from "@/components/state/failure";
import { WithAction } from "@/components/tenant/action";
import { useTenant, useViewerQuery } from "@/components/tenant/context";
import { SchoolHeaderAdd } from "@/components/tenant/header";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import {
  PeriodDialog,
  SchoolPeriodMenu,
  SchoolPeriodRestore,
} from "@/components/tenant/settings/period";
import { saveSchool } from "@/components/tenant/settings/save";
import { SettingsTablePage } from "@/components/tenant/settings/section";
import { createPeriodChange } from "@/components/tenant/settings/terms";
import {
  SchoolUnitChoice,
  type UnitId,
} from "@/components/tenant/settings/unit";
import { NoActiveUnit } from "@/components/tenant/settings/unitless";

/**
 * The look of each period status, in its table cell and in its column's filter: a planned calendar, a
 * running one, and an archive, each in its tone.
 */
const PERIOD_STATUS_LOOKS = {
  active: { icon: CalendarCheckIn01Icon, tone: "success" },
  archived: { icon: Archive02Icon, tone: "neutral" },
  planned: { icon: Calendar03Icon, tone: "info" },
} as const satisfies Record<typeof PeriodStatus.Type, StatusLook>;

const SOURCE = "components/tenant/settings/periods";

/** How many periods one page of the list loads, and each page after it. */
const PAGE_SIZE = 25;

/** One period as the periods list shows it. */
type PeriodItem = PaginatedQueryItem<typeof tenancy.periods.list>;

/** The columns of the periods table. */
const periodColumns = createColumnHelper<
  typeof dataTableFeatures,
  PeriodItem
>();

/**
 * Renders the periods of the school's unit as the page's table, with their row menus. The
 * header row holds the unit choice when the school has more than one unit, the search, the
 * status filter, and Add period once a unit is known.
 */
export function SchoolPeriodsSettings({ slug }: { slug: TenantSlug }) {
  return (
    <TableFiltersProvider>
      <ReadBoundary
        fallback={(failure) => <SettingsTablePage>{failure}</SettingsTablePage>}
        read={{ args: { slug }, ref: tenancy.viewer.get }}
      >
        <SchoolPeriodsContent />
      </ReadBoundary>
    </TableFiltersProvider>
  );
}

/**
 * The periods of the school's active unit, with the unit choice when the school has more than one unit.
 * A school with no active unit says so and links to the units, because a period belongs to a unit.
 */
function SchoolPeriodsContent() {
  const t = useTranslations("SchoolSettings");
  const viewer = useViewerQuery();
  const [chosenUnit, setChosenUnit] = useState<UnitId | undefined>(undefined);

  if (QueryResult.isFailure(viewer)) {
    throw viewer.error;
  }
  if (!QueryResult.isSuccess(viewer)) {
    return <SettingsTablePage>{null}</SettingsTablePage>;
  }
  const units = viewer.value.units;
  const unit = Option.getOrUndefined(
    Arr.findFirst(units, (candidate) =>
      chosenUnit === undefined
        ? candidate.status === "active"
        : candidate.id === chosenUnit
    )
  );

  return (
    <SettingsTablePage
      actions={
        unit === undefined ? undefined : (
          <>
            <ButtonGroup>
              {units.length > 1 ? (
                <SchoolUnitChoice
                  onChoose={setChosenUnit}
                  unitId={unit.id}
                  units={units}
                />
              ) : null}
              <TableSearch placeholder={t("periods-search")} />
            </ButtonGroup>
            <WithAction action="period.manage">
              <SchoolPeriodAdd unitId={unit.id} />
            </WithAction>
          </>
        )
      }
    >
      {unit === undefined ? (
        <NoActiveUnit />
      ) : (
        <ReadBoundary>
          <SchoolPeriodTable unitId={unit.id} />
        </ReadBoundary>
      )}
    </SettingsTablePage>
  );
}

/**
 * Renders the periods of one unit in a data table that finds a name, filters by status in its
 * column, sorts by dates in the reader's own date format, and loads more rows as its end comes into view, or the table's empty
 * state while the unit has no period. The table waits for its first page, so no empty state shows before the
 * rows arrive.
 */
function SchoolPeriodTable({ unitId }: { unitId: UnitId }) {
  const { slug } = useTenant();
  const t = useTranslations("SchoolSettings");
  const format = useFormatter();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const pagination = usePaginatedQuery(
    tenancy.periods.list,
    isSettled ? { slug, unitId } : "skip",
    { initialNumItems: PAGE_SIZE }
  );

  const failed = PaginatedQueryResult.isFailure(pagination);
  if (pagination._tag === "LoadingFirstPage") {
    return null;
  }
  if (Arr.isReadonlyArrayEmpty(pagination.results)) {
    if (failed) {
      return <LoadFailure onRetry={reloadPage} />;
    }
    return (
      <TableEmpty
        act="thinking"
        description={t("periods-description")}
        title={t("periods-empty")}
      />
    );
  }

  const columns = periodColumns.columns([
    periodColumns.accessor((period) => period.name, {
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
      filterFn: "includesString",
      header: t("period-name"),
      id: "name",
      sortFn: "text",
    }),
    periodColumns.accessor((period) => period.start, {
      cell: (info) =>
        format.dateTimeRange(
          DateTime.toDateUtc(DateTime.makeUnsafe(info.row.original.start)),
          DateTime.toDateUtc(DateTime.makeUnsafe(info.row.original.end)),
          { dateStyle: "medium", timeZone: "UTC" }
        ),
      header: t("period-dates"),
      id: "dates",
      sortFn: "text",
    }),
    periodColumns.accessor((period) => period.status, {
      cell: (info) => (
        <TableStatus
          icon={PERIOD_STATUS_LOOKS[info.getValue()].icon}
          label={t(`period-${info.getValue()}`)}
          tone={PERIOD_STATUS_LOOKS[info.getValue()].tone}
        />
      ),
      enableSorting: false,
      filterFn: "oneOf",
      header: () => (
        <ColumnFilter
          column="status"
          options={Arr.map(PeriodStatus.literals, (status) => ({
            icon: PERIOD_STATUS_LOOKS[status].icon,
            label: t(`period-${status}`),
            value: status,
          }))}
          title={t("period-status")}
        />
      ),
      id: "status",
    }),
    periodColumns.display({
      cell: (info) => (
        <WithAction action="period.manage">
          {info.row.original.status === "archived" ? (
            <SchoolPeriodRestore period={info.row.original} slug={slug} />
          ) : (
            <SchoolPeriodMenu period={info.row.original} slug={slug} />
          )}
        </WithAction>
      ),
      id: "actions",
      meta: { align: "menu" },
    }),
  ]);

  return (
    <>
      {failed ? <DataFailure onRetry={reloadPage} /> : null}
      <DataTable
        columns={columns}
        data={pagination.results}
        rowId={(period) => period.id}
        search="name"
      />
      {PaginatedQueryResult.isCanLoadMore(pagination) ? (
        <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
      ) : null}
    </>
  );
}

/** Where the add dialog starts: no name and no days. */
const NEW_PERIOD = { end: "", name: "", start: "" };

/**
 * The page's main action: Add period and the dialog it opens, for a planned period's name and its first and last days.
 * The dialog closes as the add is sent, and it starts empty again once the server accepts the period, while a refused
 * add keeps what was typed.
 */
function SchoolPeriodAdd({ unitId }: { unitId: UnitId }) {
  const { slug } = useTenant();
  const t = useTranslations("SchoolSettings");
  const create = useMutation(tenancy.periods.create).withOptimisticUpdate(
    createPeriodChange
  );
  const [round, setRound] = useState(0);
  const [open, setOpen] = useState(false);

  return (
    <>
      <SchoolHeaderAdd label={t("period-add")} onClick={() => setOpen(true)} />
      <PeriodDialog
        description={t("period-add-footer")}
        fields={NEW_PERIOD}
        key={round}
        onSave={(fields) =>
          startTransition(() =>
            saveSchool(
              () => create({ ...fields, slug, unitId }),
              SOURCE,
              () => setRound((count) => count + 1)
            )
          )
        }
        open={open}
        saveLabel={t("period-add")}
        setOpen={setOpen}
        title={t("period-add")}
      />
    </>
  );
}
