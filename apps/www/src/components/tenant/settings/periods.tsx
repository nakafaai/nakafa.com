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
import { Button } from "@repo/design-system/components/ui/button";
import { DatePicker } from "@repo/design-system/components/ui/date";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr, DateTime, Option } from "effect";
import { useId, useState, useTransition } from "react";
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
import { useTenant, useViewerQuery } from "@/components/tenant/context";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import {
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
  const [isAdding, setIsAdding] = useState(false);

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
            {units.length > 1 ? (
              <SchoolUnitChoice
                onChoose={setChosenUnit}
                unitId={unit.id}
                units={units}
              />
            ) : null}
            <TableSearch placeholder={t("periods-search")} />
            <Button onClick={() => setIsAdding(true)} type="button">
              {t("period-add")}
            </Button>
          </>
        )
      }
    >
      {unit === undefined ? (
        <NoActiveUnit />
      ) : (
        <>
          <ReadBoundary>
            <SchoolPeriodTable unitId={unit.id} />
          </ReadBoundary>
          <SchoolPeriodAddDialog
            open={isAdding}
            setOpen={setIsAdding}
            unitId={unit.id}
          />
        </>
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
      return <DataFailure onRetry={reloadPage} />;
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
      cell: (info) => (
        <span className="tabular-nums">
          {format.dateTimeRange(
            DateTime.toDateUtc(DateTime.makeUnsafe(info.row.original.start)),
            DateTime.toDateUtc(DateTime.makeUnsafe(info.row.original.end)),
            { dateStyle: "medium", timeZone: "UTC" }
          )}
        </span>
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
      meta: { align: "center" },
    }),
    periodColumns.display({
      cell: (info) =>
        info.row.original.status === "archived" ? (
          <SchoolPeriodRestore period={info.row.original} slug={slug} />
        ) : (
          <SchoolPeriodMenu period={info.row.original} slug={slug} />
        ),
      id: "actions",
      meta: { align: "end" },
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

/**
 * Renders the dialog that adds a planned period to the unit: its name, and its first and
 * last days. The dialog closes as the add is sent, and its values clear once the server
 * accepts the period.
 */
function SchoolPeriodAddDialog({
  open,
  setOpen,
  unitId,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  unitId: UnitId;
}) {
  const { slug } = useTenant();
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const id = useId();
  const create = useMutation(tenancy.periods.create).withOptimisticUpdate(
    createPeriodChange
  );
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [isPending, startSaving] = useTransition();
  const isComplete = name.trim() !== "" && start !== "" && end !== "";

  // The dialog closes as the add is sent, and the add stays inert until the save settles,
  // so a second press cannot add the same period twice.
  const submit = () => {
    setOpen(false);
    startSaving(() =>
      saveSchool(
        () =>
          create({
            end,
            name: name.trim(),
            slug,
            start,
            unitId,
          }),
        SOURCE,
        () => {
          setName("");
          setStart("");
          setEnd("");
        }
      )
    );
  };

  return (
    <ResponsiveDialog
      description={t("period-add-footer")}
      footer={
        <>
          <Button
            onClick={() => setOpen(false)}
            type="button"
            variant="outline"
          >
            {common("cancel")}
          </Button>
          <Button
            disabled={!isComplete || isPending}
            inert={isPending}
            onClick={submit}
            type="button"
          >
            {t("period-add")}
          </Button>
        </>
      }
      open={open}
      setOpen={setOpen}
      title={t("period-add")}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-name`}>{t("period-name")}</FieldLabel>
          <Input
            id={`${id}-name`}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("period-name-placeholder")}
            value={name}
          />
        </Field>
        <div className="grid grid-cols-1 gap-7 sm:grid-cols-2 sm:gap-4">
          <Field>
            <FieldLabel htmlFor={`${id}-start`}>{t("period-start")}</FieldLabel>
            <DatePicker
              id={`${id}-start`}
              max={end === "" ? undefined : end}
              onValueChange={setStart}
              placeholder={t("period-start-placeholder")}
              value={start}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-end`}>{t("period-end")}</FieldLabel>
            <DatePicker
              id={`${id}-end`}
              min={start === "" ? undefined : start}
              onValueChange={setEnd}
              placeholder={t("period-end-placeholder")}
              value={end}
            />
          </Field>
        </div>
      </FieldGroup>
    </ResponsiveDialog>
  );
}
