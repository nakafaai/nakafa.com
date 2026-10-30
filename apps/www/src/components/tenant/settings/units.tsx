import { QueryResult, useQuery } from "@confect/react";
import { Archive02Icon, SchoolIcon } from "@hugeicons/core-free-icons";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { UnitStatus } from "@repo/backend/confect/tenancy/schema";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { ColumnFilter } from "@/components/shared/table/column";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { namedOptions } from "@/components/shared/table/filter";
import { type StatusLook, TableStatus } from "@/components/shared/table/status";
import { TableFiltersProvider } from "@/components/shared/table/toolbar";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { SchoolUnitCreateDialog } from "@/components/tenant/settings/create";
import { UNIT_ICONS } from "@/components/tenant/settings/scope";
import { SettingsTablePage } from "@/components/tenant/settings/section";
import type { Unit } from "@/components/tenant/settings/state";
import { UnitMenu } from "@/components/tenant/settings/units/menu";

/** How each state of a school shows in its column: an icon that no other state shares, and its tone. */
const STATUS_LOOKS = {
  active: { icon: SchoolIcon, tone: "success" },
  archived: { icon: Archive02Icon, tone: "neutral" },
} as const satisfies Record<typeof UnitStatus.Type, StatusLook>;

/** The columns of the schools table. */
const unitColumns = createColumnHelper<typeof dataTableFeatures, Unit>();

/**
 * The schools of the organisation as the page's table, one row per school: its name, its level, its NPSN, its time
 * zone and whether it is archived, with Edit, Archive and Restore in its row menu. The header holds Add school, the
 * page's main action.
 */
export function SchoolUnitsSettings({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("SchoolSettings");
  const [isAdding, setIsAdding] = useState(false);

  return (
    <TableFiltersProvider>
      <SettingsTablePage
        actions={
          <Button onClick={() => setIsAdding(true)} type="button">
            {t("unit-add")}
          </Button>
        }
      >
        <ReadBoundary read={{ args: { slug }, ref: tenancy.units.list }}>
          <SchoolUnitsTable slug={slug} />
        </ReadBoundary>
        <SchoolUnitCreateDialog
          open={isAdding}
          setOpen={setIsAdding}
          slug={slug}
        />
      </SettingsTablePage>
    </TableFiltersProvider>
  );
}

/** The schools of the organisation in a data table, once the read has answered. */
function SchoolUnitsTable({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("SchoolSettings");
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const units = useQuery(tenancy.units.list, isSettled ? { slug } : "skip");

  if (QueryResult.isFailure(units)) {
    throw units.error;
  }
  if (!QueryResult.isSuccess(units)) {
    return null;
  }

  const levelName = (level: Unit["level"]) =>
    level === "other" ? t("level-other") : level.toUpperCase();
  const levels = Arr.dedupe(Arr.map(units.value, (unit) => unit.level));
  const columns = unitColumns.columns([
    unitColumns.accessor((unit) => unit.name, {
      cell: (info) => (
        <span className="font-medium" dir="auto">
          {info.getValue()}
        </span>
      ),
      filterFn: "includesString",
      header: t("unit-add-name"),
      id: "name",
      sortFn: "text",
    }),
    unitColumns.accessor((unit) => unit.level, {
      cell: (info) => levelName(info.getValue()),
      enableSorting: false,
      filterFn: "oneOf",
      header: () => (
        <ColumnFilter
          column="level"
          options={Arr.zipWith(
            levels,
            namedOptions(levels, UNIT_ICONS),
            (level, option) => ({
              icon: option.icon,
              label: levelName(level),
              value: level,
            })
          )}
          title={t("unit-add-level")}
        />
      ),
      id: "level",
    }),
    unitColumns.accessor((unit) => unit.npsn, {
      cell: (info) =>
        info.getValue() === null ? (
          <span className="text-muted-foreground">{t("unit-npsn-unset")}</span>
        ) : (
          <span className="tabular-nums">{info.getValue()}</span>
        ),
      enableSorting: false,
      header: t("unit-npsn"),
      id: "npsn",
    }),
    unitColumns.accessor((unit) => unit.timeZone, {
      enableSorting: false,
      header: t("unit-time-zone"),
      id: "timeZone",
    }),
    unitColumns.accessor((unit) => unit.status, {
      cell: (info) => (
        <TableStatus
          icon={STATUS_LOOKS[info.getValue()].icon}
          label={t(`unit-status-label.${info.getValue()}`)}
          tone={STATUS_LOOKS[info.getValue()].tone}
        />
      ),
      enableSorting: false,
      filterFn: "oneOf",
      header: () => (
        <ColumnFilter
          column="status"
          options={Arr.map(UnitStatus.literals, (status) => ({
            icon: STATUS_LOOKS[status].icon,
            label: t(`unit-status-label.${status}`),
            value: status,
          }))}
          title={t("unit-status")}
        />
      ),
      id: "status",
      meta: { align: "center" },
    }),
    unitColumns.display({
      cell: (info) => <UnitMenu unit={info.row.original} />,
      id: "actions",
      meta: { align: "menu" },
    }),
  ]);

  return (
    <DataTable
      columns={columns}
      data={units.value}
      rowId={(unit) => unit.id}
      search="name"
    />
  );
}
