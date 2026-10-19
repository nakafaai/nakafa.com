"use client";

import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  QueryResult,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { PeriodName, PeriodStatus } from "@repo/backend/confect/tenancy/period";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Input } from "@repo/design-system/components/ui/input";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { toast } from "@repo/design-system/lib/toast/notify";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr, Option, Schema } from "effect";
import { useTranslations } from "next-intl";
import { startTransition, useId, useState } from "react";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty } from "@/components/shared/table/frame";
import { SettingsPage } from "@/components/tenant/settings/page";
import {
  archivePeriodChange,
  createPeriodChange,
  openPeriodChange,
  renamePeriodChange,
  restorePeriodChange,
} from "@/components/tenant/settings/periods.client";
import { saveSchool } from "@/components/tenant/settings/save.client";
import { isDraft } from "@/components/tenant/settings/state";
import {
  SchoolUnitChoice,
  type UnitId,
} from "@/components/tenant/settings/unit";

const SOURCE = "components/tenant/settings/periods";

/** How many periods one page of the list loads, and each page after it. */
const PAGE_SIZE = 25;

/** The ID of one unit of the school. */

/** One period as the periods list shows it. */
type PeriodItem = PaginatedQueryItem<typeof tenancy.periods.list>;

/** The columns of the periods table. */
const periodColumns = createColumnHelper<
  typeof dataTableFeatures,
  PeriodItem
>();

/**
 * Renders the periods of the school's unit: Add period in the header once a unit is
 * known, the unit choice above the table when the school has more than one unit, and
 * the periods in a data table with their row menus.
 */
export function SchoolPeriodsSettings({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("SchoolSettings");
  const viewer = useQuery(tenancy.viewer.get, { slug });
  const [chosenUnit, setChosenUnit] = useState<UnitId | undefined>(undefined);
  const [isAdding, setIsAdding] = useState(false);
  const units = QueryResult.isSuccess(viewer) ? viewer.value.units : [];
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
      {unit === undefined ? null : (
        <>
          {units.length > 1 ? (
            <SchoolUnitChoice
              onChoose={setChosenUnit}
              unitId={unit.id}
              units={units}
            />
          ) : null}
          <SchoolPeriodTable slug={slug} unitId={unit.id} />
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
  slug,
  unitId,
}: {
  slug: TenantSlug;
  unitId: UnitId;
}) {
  const t = useTranslations("SchoolSettings");
  const pagination = usePaginatedQuery(
    tenancy.periods.list,
    { slug, unitId },
    { initialNumItems: PAGE_SIZE }
  );

  if (PaginatedQueryResult.isFailure(pagination)) {
    throw pagination.error;
  }
  if (pagination._tag === "LoadingFirstPage") {
    return null;
  }
  if (Arr.isReadonlyArrayEmpty(pagination.results)) {
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
 * A period's row menu: it renames the period, then opens a planned period or archives an
 * active one. The rename dialog saves a name that changes the stored one and passes the
 * name schema, then closes. An archived period has no menu, because the server refuses
 * every write to it, so its cell stays empty.
 */
/**
 * The restore action of an archived period in the archived list. The period shows as active at
 * once, and a refusal, such as another active period of its unit, takes it back.
 */
function SchoolPeriodRestore({
  period,
  slug,
}: {
  period: PeriodItem;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const restore = useMutation(tenancy.periods.restore).withOptimisticUpdate(
    restorePeriodChange
  );

  return (
    <div className="flex justify-end">
      <Button
        onClick={() =>
          startTransition(() =>
            saveSchool(() => restore({ periodId: period.id, slug }), SOURCE)
          )
        }
        size="sm"
        type="button"
        variant="outline"
      >
        {t("period-restore")}
      </Button>
    </div>
  );
}

function SchoolPeriodMenu({
  period,
  slug,
}: {
  period: PeriodItem;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const id = useId();
  const open = useMutation(tenancy.periods.open).withOptimisticUpdate(
    openPeriodChange
  );
  const archive = useMutation(tenancy.periods.archive).withOptimisticUpdate(
    archivePeriodChange
  );
  const restore = useMutation(tenancy.periods.restore).withOptimisticUpdate(
    restorePeriodChange
  );
  const rename = useMutation(tenancy.periods.rename).withOptimisticUpdate(
    renamePeriodChange
  );
  const [isRenaming, setIsRenaming] = useState(false);
  const [name, setName] = useState(period.name);
  const next = name.trim();
  const canSave = next !== period.name && Schema.is(PeriodName)(next);

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={common("more-actions")}
              inert={isDraft(period.id)}
              size="icon-sm"
              variant="ghost"
            >
              <HugeIcons icon={MoreHorizontalIcon} />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            onClick={() => {
              setName(period.name);
              setIsRenaming(true);
            }}
          >
            {t("period-rename")}
          </DropdownMenuItem>
          {period.status === "planned" ? (
            <DropdownMenuItem
              onClick={() =>
                startTransition(() =>
                  saveSchool(() => open({ periodId: period.id, slug }), SOURCE)
                )
              }
            >
              {t("period-open")}
            </DropdownMenuItem>
          ) : null}
          {period.status === "active" ? (
            <DropdownMenuItem
              onClick={() =>
                startTransition(() =>
                  saveSchool(
                    () => archive({ periodId: period.id, slug }),
                    SOURCE,
                    () =>
                      toast.success(
                        { title: "school-period-archived.title" },
                        {
                          action: {
                            label: "undo.title",
                            onClick: () =>
                              startTransition(() =>
                                saveSchool(
                                  () => restore({ periodId: period.id, slug }),
                                  SOURCE
                                )
                              ),
                          },
                        }
                      )
                  )
                )
              }
            >
              {t("period-archive")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <ResponsiveDialog
        footer={
          <>
            <Button
              onClick={() => setIsRenaming(false)}
              type="button"
              variant="outline"
            >
              {common("cancel")}
            </Button>
            <Button
              disabled={!canSave}
              onClick={() => {
                setIsRenaming(false);
                startTransition(() =>
                  saveSchool(
                    () => rename({ name: next, periodId: period.id, slug }),
                    SOURCE
                  )
                );
              }}
              type="button"
            >
              {t("period-rename-save")}
            </Button>
          </>
        }
        open={isRenaming}
        setOpen={setIsRenaming}
        title={t("period-rename")}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${id}-name`}>{t("period-name")}</FieldLabel>
            <Input
              id={`${id}-name`}
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </Field>
        </FieldGroup>
      </ResponsiveDialog>
    </div>
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
  const isComplete = name.trim() !== "" && start !== "" && end !== "";

  const submit = () => {
    setOpen(false);
    startTransition(() =>
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
          <Button disabled={!isComplete} onClick={submit} type="button">
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
