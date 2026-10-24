import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  QueryResult,
  useMutation,
} from "@confect/react";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { PeriodStatus } from "@repo/backend/confect/tenancy/period";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr, Option } from "effect";
import { createContext, use, useId, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty } from "@/components/shared/table/frame";
import { useViewerQuery } from "@/components/tenant/context";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import {
  SchoolPeriodMenu,
  SchoolPeriodRestore,
} from "@/components/tenant/settings/period";
import { saveSchool } from "@/components/tenant/settings/save";
import { SettingsPage } from "@/components/tenant/settings/section";
import { createPeriodChange } from "@/components/tenant/settings/terms";
import {
  SchoolUnitChoice,
  type UnitId,
} from "@/components/tenant/settings/unit";
import { NoActiveUnit } from "@/components/tenant/settings/unitless";
import { usePaginatedPreloaded } from "@/lib/data/paginated";
import type { readPeriodsFn } from "@/lib/tenant/settings.functions";

const SOURCE = "components/tenant/settings/periods";

/** How many periods one page of the list loads, and each page after it. */
export const PAGE_SIZE = 25;

/** The first screen of the periods tab: the first page of the periods of the unit the tab opens, and that unit. */
type PeriodsPreload = Pick<
  Awaited<ReturnType<typeof readPeriodsFn>>,
  "page" | "unitId"
>;

/** The ID of one unit of the school. */

/** One period as the periods list shows it. */
type PeriodItem = PaginatedQueryItem<typeof tenancy.periods.list>;

/** The columns of the periods table. */
const periodColumns = createColumnHelper<
  typeof dataTableFeatures,
  PeriodItem
>();

/** The first screen of the periods tab, which the page's loader read on the server. */
const PeriodsPreloadContext = createContext<PeriodsPreload | undefined>(
  undefined
);

/**
 * Renders the periods of the school's unit: Add period in the header once a unit is
 * known, the unit choice above the table when the school has more than one unit, and
 * the periods in a data table with their row menus.
 */
export function SchoolPeriodsSettings({
  preload,
  slug,
}: {
  preload: PeriodsPreload | undefined;
  slug: TenantSlug;
}) {
  return (
    <ReadBoundary
      fallback={(failure) => <SettingsPage>{failure}</SettingsPage>}
      read={{ args: { slug }, ref: tenancy.viewer.get }}
    >
      <PeriodsPreloadContext value={preload}>
        <SchoolPeriodsContent slug={slug} />
      </PeriodsPreloadContext>
    </ReadBoundary>
  );
}

/**
 * The periods of the school's active unit, with the unit choice when the school has more than one unit.
 * A school with no active unit says so and links to the units, because a period belongs to a unit.
 */
function SchoolPeriodsContent({ slug }: { slug: TenantSlug }) {
  const preload = use(PeriodsPreloadContext);
  const t = useTranslations("SchoolSettings");
  const viewer = useViewerQuery();
  const [chosenUnit, setChosenUnit] = useState<UnitId | undefined>(undefined);
  const [isAdding, setIsAdding] = useState(false);

  if (QueryResult.isFailure(viewer)) {
    throw viewer.error;
  }
  if (!QueryResult.isSuccess(viewer)) {
    return <SettingsPage>{null}</SettingsPage>;
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
    <SettingsPage
      actions={
        unit === undefined ? undefined : (
          <Button onClick={() => setIsAdding(true)} type="button">
            {t("period-add")}
          </Button>
        )
      }
    >
      {unit === undefined ? (
        <NoActiveUnit />
      ) : (
        <>
          {units.length > 1 ? (
            <SchoolUnitChoice
              onChoose={setChosenUnit}
              unitId={unit.id}
              units={units}
            />
          ) : null}
          <ReadBoundary>
            <SchoolPeriodTable
              first={unit.id === preload?.unitId ? preload.page : undefined}
              slug={slug}
              unitId={unit.id}
            />
          </ReadBoundary>
          <SchoolPeriodAddDialog
            open={isAdding}
            setOpen={setIsAdding}
            slug={slug}
            unitId={unit.id}
          />
        </>
      )}
    </SettingsPage>
  );
}

/**
 * Renders the periods of one unit in a data table that finds a name, filters by status,
 * sorts by dates, and loads more rows as its end comes into view, or the table's empty
 * state while the unit has no period. The table waits for its first page, so no empty state shows before the
 * rows arrive.
 */
function SchoolPeriodTable({
  first,
  slug,
  unitId,
}: {
  first: PeriodsPreload["page"] | undefined;
  slug: TenantSlug;
  unitId: UnitId;
}) {
  const t = useTranslations("SchoolSettings");
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const pagination = usePaginatedPreloaded(
    tenancy.periods.list,
    isSettled ? { slug, unitId } : "skip",
    { initialNumItems: PAGE_SIZE },
    Option.fromUndefinedOr(first)
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
      cell: (info) => `${info.row.original.start} - ${info.row.original.end}`,
      filterFn: "includesString",
      header: t("period-dates"),
      id: "dates",
      sortFn: "text",
    }),
    periodColumns.accessor((period) => period.status, {
      cell: (info) => t(`period-${info.getValue()}`),
      enableSorting: false,
      filterFn: "oneOf",
      header: t("period-status"),
      id: "status",
    }),
    periodColumns.display({
      cell: (info) =>
        info.row.original.status === "archived" ? (
          <SchoolPeriodRestore period={info.row.original} slug={slug} />
        ) : (
          <SchoolPeriodMenu period={info.row.original} slug={slug} />
        ),
      id: "actions",
    }),
  ]);

  return (
    <>
      {failed ? <DataFailure onRetry={reloadPage} /> : null}
      <DataTable
        columns={columns}
        data={pagination.results}
        facets={[
          {
            column: "status",
            options: Arr.map(PeriodStatus.literals, (status) => ({
              label: t(`period-${status}`),
              value: status,
            })),
            title: t("period-status"),
          },
        ]}
        rowId={(period) => period.id}
        search={{ column: "name", placeholder: t("periods-search") }}
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
  slug,
  unitId,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  slug: TenantSlug;
  unitId: UnitId;
}) {
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
            <Input
              id={`${id}-start`}
              onChange={(event) => setStart(event.target.value)}
              type="date"
              value={start}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-end`}>{t("period-end")}</FieldLabel>
            <Input
              id={`${id}-end`}
              onChange={(event) => setEnd(event.target.value)}
              type="date"
              value={end}
            />
          </Field>
        </div>
      </FieldGroup>
    </ResponsiveDialog>
  );
}
