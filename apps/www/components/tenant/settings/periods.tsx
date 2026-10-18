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
import { Id } from "@repo/backend/confect/_generated/id";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { PeriodName } from "@repo/backend/confect/tenancy/period";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Input } from "@repo/design-system/components/ui/input";
import { Intersection } from "@repo/design-system/components/ui/intersection";
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
import { isComposingKey } from "@repo/utilities/composition";
import { Array as Arr, Option, Schema } from "effect";
import { useTranslations } from "next-intl";
import { startTransition, useState } from "react";
import {
  CardSection,
  CardSectionActions,
  CardSectionFooter,
  CardSectionHint,
} from "@/components/shared/card/section";
import {
  archivePeriodChange,
  createPeriodChange,
  openPeriodChange,
  renamePeriodChange,
} from "@/components/tenant/settings/mutation.client";
import { saveSchool } from "@/components/tenant/settings/save.client";
import { SchoolTableHeader } from "@/components/tenant/settings/table";

const SOURCE = "components/tenant/settings/periods";

/** How many periods one page of the list loads, and each page after it. */
const PAGE_SIZE = 25;

/** The ID of one unit of the school. */
type UnitId = Ref.Returns<typeof tenancy.viewer.get>["units"][number]["id"];

/** One period as the periods list shows it. */
type PeriodItem = PaginatedQueryItem<typeof tenancy.periods.list>;

/**
 * Renders the periods of one unit: the choice of the unit when the school has
 * more than one, the list of its periods, and the form that adds a period.
 */
export function SchoolPeriodsSettings({ slug }: { slug: TenantSlug }) {
  const viewer = useQuery(tenancy.viewer.get, { slug });
  const [chosenUnit, setChosenUnit] = useState<UnitId | undefined>(undefined);

  if (!QueryResult.isSuccess(viewer)) {
    return null;
  }

  const units = viewer.value.units;
  const unit = Option.getOrUndefined(
    Arr.findFirst(units, (candidate) =>
      chosenUnit === undefined
        ? candidate.status === "active"
        : candidate.id === chosenUnit
    )
  );

  if (unit === undefined) {
    return null;
  }

  return (
    <>
      {units.length > 1 ? (
        <UnitChoice onChoose={setChosenUnit} unitId={unit.id} units={units} />
      ) : null}
      <SchoolPeriodList slug={slug} unitId={unit.id} />
      <SchoolPeriodForm slug={slug} unitId={unit.id} />
    </>
  );
}

/** Renders the choice of the unit whose periods show. */
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
    <CardSection>
      <CardHeader>
        <CardTitle>{t("unit-choice")}</CardTitle>
        <CardDescription>{t("unit-choice-description")}</CardDescription>
      </CardHeader>
      <CardContent>
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
          <SelectTrigger className="w-full max-w-xs">
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
      </CardContent>
    </CardSection>
  );
}

/**
 * Renders the periods of one unit as a list that loads more rows as its end comes
 * into view. A planned period opens, and an active one archives.
 */
function SchoolPeriodList({
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

  return (
    <CardSection>
      <CardHeader>
        <CardTitle>{t("periods")}</CardTitle>
        <CardDescription>{t("periods-description")}</CardDescription>
      </CardHeader>
      <CardContent>
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
        {PaginatedQueryResult.isCanLoadMore(pagination) ? (
          <Intersection onIntersect={() => pagination.loadMore(PAGE_SIZE)} />
        ) : null}
      </CardContent>
    </CardSection>
  );
}

/**
 * Renders the name of one period as an input in its row. The name saves when the
 * input loses focus or the Enter key is pressed, and the new name shows at once.
 * A name left empty, or one that the schema refuses, goes back to the stored name.
 */
function SchoolPeriodName({
  period,
  slug,
}: {
  period: PeriodItem;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const rename = useMutation(tenancy.periods.rename).withOptimisticUpdate(
    renamePeriodChange
  );
  const [name, setName] = useState(period.name);

  const save = () => {
    const next = name.trim();
    if (next === period.name || !Schema.is(PeriodName)(next)) {
      setName(period.name);
      return;
    }
    startTransition(() =>
      saveSchool(
        () => rename({ name: next, periodId: period.id, slug }),
        SOURCE
      )
    );
  };

  return (
    <Input
      aria-label={t("period-name")}
      onBlur={save}
      onChange={(event) => setName(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !isComposingKey(event.nativeEvent)) {
          event.currentTarget.blur();
        }
      }}
      value={name}
    />
  );
}

/** Renders one period row, with the one action that its status allows. */
function SchoolPeriodRow({
  period,
  slug,
}: {
  period: PeriodItem;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const open = useMutation(tenancy.periods.open).withOptimisticUpdate(
    openPeriodChange
  );
  const archive = useMutation(tenancy.periods.archive).withOptimisticUpdate(
    archivePeriodChange
  );

  return (
    <TableRow>
      <TableCell>
        <SchoolPeriodName key={period.name} period={period} slug={slug} />
      </TableCell>
      <TableCell>{`${period.start} - ${period.end}`}</TableCell>
      <TableCell>{t(`period-${period.status}`)}</TableCell>
      <TableCell className="text-right">
        {period.status === "planned" ? (
          <Button
            onClick={() =>
              startTransition(() =>
                saveSchool(() => open({ periodId: period.id, slug }), SOURCE)
              )
            }
            size="sm"
            type="button"
            variant="outline"
          >
            {t("period-open")}
          </Button>
        ) : null}
        {period.status === "active" ? (
          <Button
            onClick={() =>
              startTransition(() =>
                saveSchool(() => archive({ periodId: period.id, slug }), SOURCE)
              )
            }
            size="sm"
            type="button"
            variant="outline"
          >
            {t("period-archive")}
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

/** Renders the form that adds a period to the unit: its name, and its first and last days. */
function SchoolPeriodForm({
  slug,
  unitId,
}: {
  slug: TenantSlug;
  unitId: UnitId;
}) {
  const t = useTranslations("SchoolSettings");
  const create = useMutation(tenancy.periods.create).withOptimisticUpdate(
    createPeriodChange
  );
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const isComplete = name.trim() !== "" && start !== "" && end !== "";

  return (
    <CardSection>
      <CardHeader>
        <CardTitle>{t("period-add")}</CardTitle>
        <CardDescription>{t("period-add-description")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3">
        <Input
          aria-label={t("period-name")}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("period-name-placeholder")}
          value={name}
        />
        <Input
          aria-label={t("period-start")}
          onChange={(event) => setStart(event.target.value)}
          type="date"
          value={start}
        />
        <Input
          aria-label={t("period-end")}
          onChange={(event) => setEnd(event.target.value)}
          type="date"
          value={end}
        />
      </CardContent>
      <CardSectionFooter>
        <CardSectionHint>{t("period-add-footer")}</CardSectionHint>
        <CardSectionActions>
          <Button
            disabled={!isComplete}
            onClick={() => {
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
                  SOURCE
                )
              );
            }}
            size="sm"
            type="button"
          >
            {t("period-add")}
          </Button>
        </CardSectionActions>
      </CardSectionFooter>
    </CardSection>
  );
}
