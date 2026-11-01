import { QueryResult, useQuery } from "@confect/react";
import {
  Archive02Icon,
  Clock01Icon,
  Globe02Icon,
  SchoolIcon,
  TimeZoneIcon,
} from "@hugeicons/core-free-icons";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { UnitStatus } from "@repo/backend/confect/tenancy/schema";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Array as Arr } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { namedOptions } from "@/components/shared/table/filter";
import { type StatusLook, TableStatus } from "@/components/shared/table/status";
import { TableTitle } from "@/components/shared/table/title";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { SchoolHeaderAdd } from "@/components/tenant/header";
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

/** The icons of the time zones in their column's filter. */
const TIME_ZONE_ICONS = [TimeZoneIcon, Globe02Icon, Clock01Icon] as const;

/** The columns of the schools table. */
const unitColumns = tableColumns<Unit>();

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
          <>
            <TableSearch placeholder={t("units-search")} />
            <SchoolHeaderAdd
              label={t("unit-add")}
              onClick={() => setIsAdding(true)}
            />
          </>
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
  const zones = Arr.dedupe(Arr.map(units.value, (unit) => unit.timeZone));
  const columns = [
    // The name with the NPSN after it, so the header's search finds a school by either; the cell shows the name.
    unitColumns.text((unit) => `${unit.name} ${unit.npsn ?? ""}`, {
      cell: (info) => (
        <TableTitle icon={SchoolIcon}>
          <span dir="auto">{info.row.original.name}</span>
        </TableTitle>
      ),
      header: t("unit-add-name"),
      id: "name",
    }),
    unitColumns.values((unit) => unit.level, {
      cell: (info) => levelName(info.getValue()),
      header: t("unit-add-level"),
      id: "level",
      options: Arr.zipWith(
        levels,
        namedOptions(levels, UNIT_ICONS),
        (level, option) => ({
          icon: option.icon,
          label: levelName(level),
          value: level,
        })
      ),
    }),
    unitColumns.text((unit) => unit.npsn ?? "", {
      cell: (info) =>
        info.getValue() === "" ? (
          <span className="text-muted-foreground">{t("unit-npsn-unset")}</span>
        ) : (
          <span className="tabular-nums">{info.getValue()}</span>
        ),
      header: t("unit-npsn"),
      id: "npsn",
    }),
    unitColumns.values((unit) => unit.timeZone, {
      header: t("unit-time-zone"),
      id: "timeZone",
      options: namedOptions(zones, TIME_ZONE_ICONS),
    }),
    unitColumns.values((unit) => unit.status, {
      cell: (info) => (
        <TableStatus
          icon={STATUS_LOOKS[info.getValue()].icon}
          label={t(`unit-status-label.${info.getValue()}`)}
          tone={STATUS_LOOKS[info.getValue()].tone}
        />
      ),
      header: t("unit-status"),
      id: "status",
      options: Arr.map(UnitStatus.literals, (status) => ({
        icon: STATUS_LOOKS[status].icon,
        label: t(`unit-status-label.${status}`),
        value: status,
      })),
    }),
    unitColumns.menu((info) => <UnitMenu unit={info.row.original} />),
  ];

  return (
    <DataTable
      columns={columns}
      data={units.value}
      rowId={(unit) => unit.id}
      search="name"
    />
  );
}
