"use client";

import type { Ref } from "@confect/core";
import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  QueryResult,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "@confect/react";
import { Calendar03Icon, MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { Id } from "@repo/backend/confect/_generated/id";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { PeriodName } from "@repo/backend/confect/tenancy/period";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { Array as Arr, Option, Schema } from "effect";
import { useTranslations } from "next-intl";
import { startTransition, useId, useState } from "react";
import { TableEmpty, TableFrame } from "@/components/shared/table/frame";
import { SettingsPage } from "@/components/tenant/settings/page";
import {
  archivePeriodChange,
  createPeriodChange,
  openPeriodChange,
  renamePeriodChange,
} from "@/components/tenant/settings/periods.client";
import { saveSchool } from "@/components/tenant/settings/save.client";
import { isDraft } from "@/components/tenant/settings/state";
import { SchoolTableHeader } from "@/components/tenant/settings/table";

const SOURCE = "components/tenant/settings/periods";

/** How many periods one page of the list loads, and each page after it. */
const PAGE_SIZE = 25;

/** The ID of one unit of the school. */
type UnitId = Ref.Returns<typeof tenancy.viewer.get>["units"][number]["id"];

/** One period as the periods list shows it. */
type PeriodItem = PaginatedQueryItem<typeof tenancy.periods.list>;

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
            <UnitChoice
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

/** Renders the unit whose periods show, as a toolbar row above the periods table. */
function UnitChoice({
  onChoose,
  unitId,
  units,
}: {
  onChoose: (unitId: UnitId) => void;
  unitId: UnitId;
  units: readonly { readonly id: UnitId; readonly name: string }[];
}) {
  const t = useTranslations("SchoolSettings");
  const items = Arr.map(units, (unit) => ({
    label: unit.name,
    value: unit.id,
  }));

  return (
    <div className="flex items-center gap-2">
      <Select
        items={items}
        onValueChange={(value) => {
          const chosen = Schema.decodeUnknownOption(Id("tenantUnits"))(value);
          if (Option.isSome(chosen)) {
            onChoose(chosen.value);
          }
        }}
        value={unitId}
      >
        <SelectTrigger
          aria-label={t("unit-choice")}
          className="w-full max-w-xs"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {Arr.map(items, (item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Renders the periods of one unit in a data table that loads more rows as its end comes
 * into view, or the table's empty state while the unit has no period. The table waits
 * for its first page, so no empty state shows before the rows arrive.
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
        description={t("periods-description")}
        icon={<HugeIcons icon={Calendar03Icon} />}
        title={t("periods-empty")}
      />
    );
  }

  return (
    <>
      <TableFrame>
        <Table>
          <SchoolTableHeader
            columns={[
              t("period-name"),
              t("period-dates"),
              t("period-status"),
              "",
            ]}
          />
          <TableBody>
            {Arr.map(pagination.results, (period) => (
              <SchoolPeriodRow key={period.id} period={period} slug={slug} />
            ))}
          </TableBody>
        </Table>
      </TableFrame>
      {PaginatedQueryResult.isCanLoadMore(pagination) ? (
        <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
      ) : null}
    </>
  );
}

/**
 * Renders one period row: its name, its dates, and its status. The row menu renames the
 * period, then opens a planned period or archives an active one. An archived period has
 * no menu, because the server refuses every write to it. The rename dialog saves a name
 * that changes the stored one and passes the name schema, then closes.
 */
function SchoolPeriodRow({
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
  const rename = useMutation(tenancy.periods.rename).withOptimisticUpdate(
    renamePeriodChange
  );
  const [isRenaming, setIsRenaming] = useState(false);
  const [name, setName] = useState(period.name);
  const next = name.trim();
  const canSave = next !== period.name && Schema.is(PeriodName)(next);

  return (
    <TableRow>
      <TableCell className="font-medium">{period.name}</TableCell>
      <TableCell>{`${period.start} - ${period.end}`}</TableCell>
      <TableCell>{t(`period-${period.status}`)}</TableCell>
      <TableCell className="text-right">
        {period.status === "archived" ? null : (
          <>
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
                        saveSchool(
                          () => open({ periodId: period.id, slug }),
                          SOURCE
                        )
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
                          SOURCE
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
                          () =>
                            rename({ name: next, periodId: period.id, slug }),
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
                  <FieldLabel htmlFor={`${id}-name`}>
                    {t("period-name")}
                  </FieldLabel>
                  <Input
                    id={`${id}-name`}
                    onChange={(event) => setName(event.target.value)}
                    value={name}
                  />
                </Field>
              </FieldGroup>
            </ResponsiveDialog>
          </>
        )}
      </TableCell>
    </TableRow>
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
