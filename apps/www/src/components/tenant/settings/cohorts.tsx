import { QueryResult, useMutation, useQuery } from "@confect/react";
import { UserGroupIcon } from "@hugeicons/core-free-icons";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { CohortName, CohortStatus } from "@repo/backend/confect/tenancy/cohort";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { FieldGroup } from "@repo/design-system/components/ui/field";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Array as Arr, Option, Order, Schema } from "effect";
import { createContext, use, useId, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { tableColumns } from "@/components/shared/table/columns";
import { DataTable } from "@/components/shared/table/data";
import { namedOptions } from "@/components/shared/table/filter";
import { TableEmpty } from "@/components/shared/table/frame";
import { TableStatus } from "@/components/shared/table/status";
import { TableTitle } from "@/components/shared/table/title";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { WithAction } from "@/components/tenant/action";
import { useTenant, useViewerQuery } from "@/components/tenant/context";
import { SchoolHeaderAdd } from "@/components/tenant/header";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { isDenied } from "@/components/tenant/refusal";
import { chosenGrade, GRADE_ICONS } from "@/components/tenant/settings/choices";
import {
  CohortGradeField,
  CohortNameField,
} from "@/components/tenant/settings/cohort/fields";
import {
  SchoolCohortMenu,
  SchoolCohortRestore,
} from "@/components/tenant/settings/cohort/menu";
import { COHORT_STATUS_LOOKS } from "@/components/tenant/settings/cohort/status";
import { createCohortChange } from "@/components/tenant/settings/groups";
import { saveSchool } from "@/components/tenant/settings/save";
import { SettingsTablePage } from "@/components/tenant/settings/section";
import type { Cohort, Period } from "@/components/tenant/settings/state";
import {
  SchoolUnitChoice,
  type UnitId,
} from "@/components/tenant/settings/unit";
import { NoActiveUnit } from "@/components/tenant/settings/unitless";
import { Link } from "@/lib/routing/link";

const SOURCE = "components/tenant/settings/cohorts";

/** The columns of the cohorts table. */
const cohortColumns = tableColumns<Cohort>();

/** The unit whose cohorts the tab shows, the school's units, and the choice of another one. */
const CohortsUnitContext = createContext<{
  onChoose: (unitId: UnitId) => void;
  unitId: UnitId;
  units: readonly { readonly id: UnitId; readonly name: string }[];
} | null>(null);

/** Reads the unit of the cohorts tab. */
function useCohortsUnit() {
  const value = use(CohortsUnitContext);
  if (value === null) {
    throw new Error("useCohortsUnit must be used within SchoolCohortsContent");
  }
  return value;
}

/**
 * Renders the cohorts of the school's unit, which belong to the unit's active period: the unit
 * choice above the table when the school has more than one unit, and the page's one action, Add
 * cohort, in the header once the unit has an active period. A school with no active unit says
 * so and links to the units, because a cohort belongs to a period of a unit.
 */
export function SchoolCohortsSettings({ slug }: { slug: TenantSlug }) {
  return (
    <TableFiltersProvider>
      <ReadBoundary
        fallback={(failure) => <SettingsTablePage>{failure}</SettingsTablePage>}
        read={{ args: { slug }, ref: tenancy.viewer.get }}
      >
        <SchoolCohortsContent />
      </ReadBoundary>
    </TableFiltersProvider>
  );
}

/** The cohorts of the school's active unit, once the viewer's units are in. */
function SchoolCohortsContent() {
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

  if (unit === undefined) {
    return (
      <SettingsTablePage>
        <NoActiveUnit />
      </SettingsTablePage>
    );
  }
  return (
    <CohortsUnitContext
      value={{ onChoose: setChosenUnit, unitId: unit.id, units }}
    >
      <SchoolCohortsOfUnit />
    </CohortsUnitContext>
  );
}

/**
 * Renders the cohorts of one unit's active period. A unit with no active period shows an empty
 * state, which links to the periods, because a cohort belongs to a period. A failed read of the
 * active period shows its own sentence and Try again.
 */
function SchoolCohortsOfUnit() {
  const { slug } = useTenant();
  const { unitId } = useCohortsUnit();

  return (
    <ReadBoundary
      fallback={(failure) => (
        <SettingsTablePage actions={<CohortsUnitChoice />}>
          {failure}
        </SettingsTablePage>
      )}
      read={{ args: { slug, unitId }, ref: tenancy.cohorts.activePeriod }}
    >
      <SchoolCohortsOfPeriod slug={slug} />
    </ReadBoundary>
  );
}

/** The choice of the unit above the cohorts, shown only to a school with more than one unit. */
function CohortsUnitChoice() {
  const { onChoose, unitId, units } = useCohortsUnit();

  return units.length > 1 ? (
    <SchoolUnitChoice onChoose={onChoose} unitId={unitId} units={units} />
  ) : null;
}

/**
 * The active period of the chosen unit, read once Convex has settled the session: pending while it is read, null for a
 * unit with none, and a failure for a unit the viewer may not read. Any other failure is thrown to the page's boundary.
 */
function useActivePeriod(slug: TenantSlug) {
  const { unitId } = useCohortsUnit();
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const active = useQuery(
    tenancy.cohorts.activePeriod,
    isSettled ? { slug, unitId } : "skip"
  );
  if (QueryResult.isFailure(active) && !isDenied(active.error)) {
    throw active.error;
  }
  return active;
}

/**
 * The cohorts page's actions, drawn final from the first paint and never changed by the period's answer: the unit
 * choice, the search and Add cohort, whose dialog waits for the period itself.
 */
function CohortsActions({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("SchoolSettings");
  const active = useActivePeriod(slug);

  return (
    <>
      <ButtonGroup>
        <CohortsUnitChoice />
        <TableSearch placeholder={t("cohorts-search")} />
      </ButtonGroup>
      <WithAction action="cohort.manage">
        <SchoolCohortAdd active={active} slug={slug} />
      </WithAction>
    </>
  );
}

/** The table of the unit's active period, or the state of a unit that has none, once the period is read. */
function SchoolCohortsOfPeriod({ slug }: { slug: TenantSlug }) {
  const t = useTranslations("SchoolSettings");
  const active = useActivePeriod(slug);
  const periodId = QueryResult.isSuccess(active) ? active.value : undefined;

  if (QueryResult.isFailure(active)) {
    return (
      <SettingsTablePage actions={<CohortsActions slug={slug} />}>
        <TableEmpty
          act="pointing"
          description={t("cohorts-unavailable-description")}
          title={t("cohorts-unavailable")}
        />
      </SettingsTablePage>
    );
  }
  if (periodId === undefined) {
    return (
      <SettingsTablePage actions={<CohortsActions slug={slug} />}>
        {null}
      </SettingsTablePage>
    );
  }
  if (periodId === null) {
    return (
      <SettingsTablePage actions={<CohortsActions slug={slug} />}>
        <TableEmpty
          act="pointing"
          action={
            <Link
              className={buttonVariants({ variant: "outline" })}
              params={{ slug }}
              to="/school/$slug/settings/periods"
            >
              {t("cohorts-no-period-action")}
            </Link>
          }
          description={t("cohorts-no-period")}
          title={t("cohorts-no-period-title")}
        />
      </SettingsTablePage>
    );
  }
  return (
    <SettingsTablePage actions={<CohortsActions slug={slug} />}>
      <ReadBoundary
        read={{ args: { periodId, slug }, ref: tenancy.cohorts.list }}
      >
        <SchoolCohortTable periodId={periodId} slug={slug} />
      </ReadBoundary>
    </SettingsTablePage>
  );
}

/**
 * The page's one action: the Add cohort button and the dialog it opens, for a name and a
 * school year. The button is ready from the first paint, and the dialog waits for the period:
 * Save holds until the active period is known, and a unit with none says to open one first.
 * The dialog closes as the add is sent, and its values clear once the server accepts the cohort.
 */
function SchoolCohortAdd({
  active,
  slug,
}: {
  /** The read of the active period the cohort joins: its ID, or null for a unit with none. */
  active: QueryResult.QueryResult<Period["id"] | null, unknown>;
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
  const periodId = QueryResult.isSuccess(active) ? active.value : null;
  const hasNoPeriod = QueryResult.isSuccess(active) && active.value === null;

  const submit = () => {
    if (
      periodId === null ||
      Option.isNone(grade) ||
      !Schema.is(CohortName)(next)
    ) {
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
      <SchoolHeaderAdd
        label={t("cohort-create")}
        onClick={() => setIsOpen(true)}
      />
      <ResponsiveDialog
        description={
          hasNoPeriod ? t("cohort-add-no-period") : t("cohort-add-footer")
        }
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
              disabled={periodId === null || !isComplete || isPending}
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
          <CohortNameField id={`${id}-name`} onChange={setName} value={name} />
          <CohortGradeField
            id={`${id}-grade`}
            onChange={setGradeValue}
            value={gradeValue}
          />
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
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const cohorts = useQuery(
    tenancy.cohorts.list,
    isSettled ? { periodId, slug } : "skip"
  );
  const overview = useQuery(
    tenancy.cohorts.overview,
    isSettled ? { periodId, slug } : "skip"
  );
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

  const overviewOf = (id: string) =>
    QueryResult.isSuccess(overview)
      ? Arr.findFirst(overview.value, (cohort) => cohort.id === id)
      : Option.none();
  const columns = [
    cohortColumns.text((cohort) => cohort.name, {
      cell: (info) => (
        <TableTitle icon={UserGroupIcon}>
          <Link
            params={{ cohort: info.row.original.id, slug }}
            to="/school/$slug/settings/cohorts/$cohort"
          >
            {info.getValue()}
          </Link>
        </TableTitle>
      ),
      header: t("cohort-name"),
      id: "name",
    }),
    cohortColumns.values((cohort) => String(cohort.grade), {
      header: t("cohort-grade"),
      id: "grade",
      options: namedOptions(
        Arr.map(
          Arr.sort(
            Arr.dedupe(Arr.map(cohorts.value, (cohort) => cohort.grade)),
            Order.Number
          ),
          String
        ),
        GRADE_ICONS
      ),
    }),
    cohortColumns.text(
      (cohort) =>
        Option.getOrElse(
          Option.flatMapNullishOr(
            overviewOf(cohort.id),
            (found) => found.homeroom
          ),
          () => ""
        ),
      { header: t("cohort-homeroom"), id: "homeroom" }
    ),
    cohortColumns.number(
      (cohort) =>
        Option.match(overviewOf(cohort.id), {
          onNone: () => null,
          onSome: (found) => found.students,
        }),
      { header: t("cohort-students"), id: "students" }
    ),
    cohortColumns.number(
      (cohort) =>
        Option.match(overviewOf(cohort.id), {
          onNone: () => null,
          onSome: (found) => found.classes,
        }),
      { header: t("cohort-classes"), id: "classes" }
    ),
    cohortColumns.values((cohort) => cohort.status, {
      cell: (info) => (
        <TableStatus
          icon={COHORT_STATUS_LOOKS[info.getValue()].icon}
          label={t(`cohort-${info.getValue()}`)}
          tone={COHORT_STATUS_LOOKS[info.getValue()].tone}
        />
      ),
      header: t("cohort-status"),
      id: "status",
      options: Arr.map(CohortStatus.literals, (status) => ({
        icon: COHORT_STATUS_LOOKS[status].icon,
        label: t(`cohort-${status}`),
        value: status,
      })),
    }),
    cohortColumns.menu((info) => (
      <WithAction action="cohort.manage">
        {info.row.original.status === "archived" ? (
          <SchoolCohortRestore cohort={info.row.original} slug={slug} />
        ) : (
          <SchoolCohortMenu cohort={info.row.original} slug={slug} />
        )}
      </WithAction>
    )),
  ];

  return (
    <DataTable
      columns={columns}
      data={cohorts.value}
      rowId={(cohort) => cohort.id}
      search="name"
    />
  );
}
