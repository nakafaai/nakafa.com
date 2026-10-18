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
import { createColumnHelper } from "@tanstack/react-table";
import { Array as Arr, Option, Schema } from "effect";
import { useTranslations } from "next-intl";
import { startTransition, useId, useState } from "react";
import { DataTable } from "@/components/shared/table/data";
import type { dataTableFeatures } from "@/components/shared/table/features";
import { TableEmpty } from "@/components/shared/table/frame";
import { SchoolCohortMenu } from "@/components/tenant/settings/cohort";
import { createCohortChange } from "@/components/tenant/settings/cohorts.client";
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
 * Renders the cohorts of the school's unit, which belong to the unit's active period: the
 * unit choice above the table when the school has more than one unit, and the page's one
 * action, Add cohort, in the header once the unit has an active period.
 */
export function SchoolCohortsSettings({ slug }: { slug: TenantSlug }) {
  const viewer = useQuery(tenancy.viewer.get, { slug });
  const [chosenUnit, setChosenUnit] = useState<UnitId | undefined>(undefined);
  const units = QueryResult.isSuccess(viewer) ? viewer.value.units : [];
  const unit = Option.getOrUndefined(
    Arr.findFirst(units, (candidate) =>
      chosenUnit === undefined
        ? candidate.status === "active"
        : candidate.id === chosenUnit
    )
  );

  if (unit === undefined) {
    return <SettingsPage>{null}</SettingsPage>;
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
 * Renders the cohorts of one unit's active period. A unit with no active period shows
 * an empty state and no add action, because a cohort belongs to a period.
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
  const t = useTranslations("SchoolSettings");
  const active = useQuery(tenancy.cohorts.activePeriod, { slug, unitId });
  if (QueryResult.isFailure(active)) {
    throw active.error;
  }
  const periodId = QueryResult.isSuccess(active) ? active.value : undefined;
  const choice =
    units.length > 1 ? (
      <SchoolUnitChoice onChoose={onChoose} unitId={unitId} units={units} />
    ) : null;

  if (periodId === undefined) {
    return <SettingsPage>{choice}</SettingsPage>;
  }
  if (periodId === null) {
    return (
      <SettingsPage>
        {choice}
        <TableEmpty
          act="pointing"
          description={t("cohorts-no-period")}
          title={t("cohorts-no-period-title")}
        />
      </SettingsPage>
    );
  }
  return (
    <SettingsPage actions={<SchoolCohortAdd periodId={periodId} slug={slug} />}>
      {choice}
      <SchoolCohortTable periodId={periodId} slug={slug} />
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
    startTransition(() =>
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
            <Button disabled={!isComplete} onClick={submit} type="button">
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
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
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
