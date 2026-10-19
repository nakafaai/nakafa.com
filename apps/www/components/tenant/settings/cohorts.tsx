"use client";

import { QueryResult, useMutation, useQuery } from "@confect/react";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import {
  COHORT_GRADE_MAX,
  COHORT_GRADE_MIN,
  CohortGrade,
  CohortName,
  CohortStatus,
} from "@repo/backend/confect/tenancy/cohort";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { buttonVariants } from "@repo/design-system/lib/button";
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr, Option, Schema } from "effect";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { type ReactNode, useId, useState, useTransition } from "react";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty } from "@/components/shared/table/frame";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { SchoolCohortMenu } from "@/components/tenant/settings/cohort";
import { createCohortChange } from "@/components/tenant/settings/cohorts.client";
import { NoActiveUnit } from "@/components/tenant/settings/no-unit";
import { SettingsPage } from "@/components/tenant/settings/page";
import { saveSchool } from "@/components/tenant/settings/save.client";
import type { Cohort, Period } from "@/components/tenant/settings/state";
import {
  SchoolUnitChoice,
  type UnitId,
} from "@/components/tenant/settings/unit";

const SOURCE = "components/tenant/settings/cohorts";

/** The school years a cohort may hold, as the grade choices of its dialog and of its filter. */
const gradeItems = Arr.makeBy(
  COHORT_GRADE_MAX - COHORT_GRADE_MIN + 1,
  (index) => {
    const grade = String(COHORT_GRADE_MIN + index);
    return { label: grade, value: grade };
  }
);

/** The columns of the cohorts table. */
const cohortColumns = createColumnHelper<typeof dataTableFeatures, Cohort>();

/**
 * Renders the cohorts of the school's unit, which belong to the unit's active period: the unit
 * choice above the table when the school has more than one unit, and the page's one action, Add
 * cohort, in the header once the unit has an active period. A school with no active unit says
 * so and links to the units, because a cohort belongs to a period of a unit.
 */
export function SchoolCohortsSettings({ slug }: { slug: TenantSlug }) {
  return (
    <ReadBoundary
      fallback={(failure) => <SettingsPage>{failure}</SettingsPage>}
      read={{ args: { slug }, ref: tenancy.viewer.get }}
    >
      <SchoolCohortsContent slug={slug} />
    </ReadBoundary>
  );
}

/** The cohorts of the school's active unit, once the viewer's units are in. */
function SchoolCohortsContent({ slug }: { slug: TenantSlug }) {
  const viewer = useQuery(tenancy.viewer.get, { slug });
  const [chosenUnit, setChosenUnit] = useState<UnitId | undefined>(undefined);

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

  if (unit === undefined) {
    return (
      <SettingsPage>
        <NoActiveUnit />
      </SettingsPage>
    );
  }
  return (
    <SchoolCohortsOfUnit
      onChoose={setChosenUnit}
      slug={slug}
      unitId={unit.id}
      units={units}
    />
  );
}

/**
 * Renders the cohorts of one unit's active period. A unit with no active period shows an empty
 * state, which links to the periods, and no add action, because a cohort belongs to a period.
 * A failed read of the active period shows its own sentence and Try again.
 */
function SchoolCohortsOfUnit({
  onChoose,
  slug,
  unitId,
  units,
}: {
  onChoose: (unitId: UnitId) => void;
  slug: TenantSlug;
  unitId: UnitId;
  units: readonly { readonly id: UnitId; readonly name: string }[];
}) {
  const choice =
    units.length > 1 ? (
      <SchoolUnitChoice onChoose={onChoose} unitId={unitId} units={units} />
    ) : null;

  return (
    <ReadBoundary
      fallback={(failure) => (
        <SettingsPage>
          {choice}
          {failure}
        </SettingsPage>
      )}
      read={{ args: { slug, unitId }, ref: tenancy.cohorts.activePeriod }}
    >
      <SchoolCohortsOfPeriod choice={choice} slug={slug} unitId={unitId} />
    </ReadBoundary>
  );
}

/** The table of the unit's active period, or the state of a unit that has none, once the period is read. */
function SchoolCohortsOfPeriod({
  choice,
  slug,
  unitId,
}: {
  choice: ReactNode;
  slug: TenantSlug;
  unitId: UnitId;
}) {
  const t = useTranslations("SchoolSettings");
  const active = useQuery(tenancy.cohorts.activePeriod, { slug, unitId });
  if (QueryResult.isFailure(active)) {
    throw active.error;
  }
  const periodId = QueryResult.isSuccess(active) ? active.value : undefined;

  if (periodId === undefined) {
    return <SettingsPage>{choice}</SettingsPage>;
  }
  if (periodId === null) {
    return (
      <SettingsPage>
        {choice}
        <TableEmpty
          act="pointing"
          action={
            <Link
              className={buttonVariants({ variant: "outline" })}
              href="/settings/periods"
            >
              {t("cohorts-no-period-action")}
            </Link>
          }
          description={t("cohorts-no-period")}
          title={t("cohorts-no-period-title")}
        />
      </SettingsPage>
    );
  }
  return (
    <SettingsPage actions={<SchoolCohortAdd periodId={periodId} slug={slug} />}>
      {choice}
      <ReadBoundary
        read={{ args: { periodId, slug }, ref: tenancy.cohorts.list }}
      >
        <SchoolCohortTable periodId={periodId} slug={slug} />
      </ReadBoundary>
    </SettingsPage>
  );
}

/** The school year that a grade choice holds, if the choice holds one the schema accepts. */
function chosenGrade(value: string | null) {
  return value === null
    ? Option.none()
    : Schema.decodeOption(CohortGrade)(Number(value));
}

/**
 * The page's one action: the Add cohort button and the dialog it opens, for a name and a
 * school year. The dialog closes as the add is sent, and its values clear once the server
 * accepts the cohort.
 */
function SchoolCohortAdd({
  periodId,
  slug,
}: {
  periodId: Period["id"];
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const common = useTranslations("Common");
  const id = useId();
  const create = useMutation(tenancy.cohorts.create).withOptimisticUpdate(
    createCohortChange
  );
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startSaving] = useTransition();
  const [name, setName] = useState("");
  const [gradeValue, setGradeValue] = useState<string | null>(null);
  const next = name.trim();
  const grade = chosenGrade(gradeValue);
  const isComplete = Option.isSome(grade) && Schema.is(CohortName)(next);

  const submit = () => {
    if (Option.isNone(grade) || !Schema.is(CohortName)(next)) {
      return;
    }
    setIsOpen(false);
    startSaving(() =>
      saveSchool(
        () =>
          create({
            grade: grade.value,
            name: next,
            periodId,
            slug,
          }),
        SOURCE,
        () => {
          setName("");
          setGradeValue(null);
        }
      )
    );
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)} type="button">
        {t("cohort-create")}
      </Button>
      <ResponsiveDialog
        description={t("cohort-add-footer")}
        footer={
          <>
            <Button
              onClick={() => setIsOpen(false)}
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
              {t("cohort-create")}
            </Button>
          </>
        }
        open={isOpen}
        setOpen={setIsOpen}
        title={t("cohort-create")}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${id}-name`}>{t("cohort-name")}</FieldLabel>
            <Input
              id={`${id}-name`}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("cohort-name-placeholder")}
              value={name}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-grade`}>{t("cohort-grade")}</FieldLabel>
            <Select
              items={gradeItems}
              onValueChange={setGradeValue}
              value={gradeValue}
            >
              <SelectTrigger className="w-full" id={`${id}-grade`}>
                <SelectValue placeholder={t("cohort-grade-placeholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {Arr.map(gradeItems, (item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>
      </ResponsiveDialog>
    </>
  );
}

/**
 * Renders the cohorts of one period in a data table that finds a name, filters by grade
 * and status, and sorts, with each cohort's row menu. The table waits for its list, so no
 * empty state shows before the rows arrive, and a period with no cohort shows the empty state.
 */
function SchoolCohortTable({
  periodId,
  slug,
}: {
  periodId: Period["id"];
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const cohorts = useQuery(tenancy.cohorts.list, { periodId, slug });
  if (QueryResult.isFailure(cohorts)) {
    throw cohorts.error;
  }
  if (!QueryResult.isSuccess(cohorts)) {
    return null;
  }
  if (Arr.isReadonlyArrayEmpty(cohorts.value)) {
    return (
      <TableEmpty
        act="writing"
        description={t("cohorts-description")}
        title={t("cohorts-empty")}
      />
    );
  }

  const columns = cohortColumns.columns([
    cohortColumns.accessor((cohort) => cohort.name, {
      cell: (info) => (
        <Link
          className="font-medium"
          href={`/settings/cohorts/${info.row.original.id}`}
        >
          {info.getValue()}
        </Link>
      ),
      filterFn: "includesString",
      header: t("cohort-name"),
      id: "name",
      sortFn: "text",
    }),
    cohortColumns.accessor((cohort) => String(cohort.grade), {
      filterFn: "oneOf",
      header: t("cohort-grade"),
      id: "grade",
      sortFn: "alphanumeric",
    }),
    cohortColumns.accessor((cohort) => cohort.status, {
      cell: (info) => t(`cohort-${info.getValue()}`),
      enableSorting: false,
      filterFn: "oneOf",
      header: t("cohort-status"),
      id: "status",
    }),
    cohortColumns.display({
      cell: (info) =>
        info.row.original.status === "archived" ? null : (
          <SchoolCohortMenu cohort={info.row.original} slug={slug} />
        ),
      id: "actions",
    }),
  ]);

  return (
    <DataTable
      columns={columns}
      data={cohorts.value}
      facets={[
        {
          column: "grade",
          options: gradeItems,
          title: t("cohort-grade"),
        },
        {
          column: "status",
          options: Arr.map(CohortStatus.literals, (status) => ({
            label: t(`cohort-${status}`),
            value: status,
          })),
          title: t("cohort-status"),
        },
      ]}
      rowId={(cohort) => cohort.id}
      search={{ column: "name", placeholder: t("cohorts-search") }}
    />
  );
}
