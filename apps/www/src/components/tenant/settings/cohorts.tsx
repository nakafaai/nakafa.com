import { QueryResult, useMutation, useQuery } from "@confect/react";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { CohortName } from "@repo/backend/confect/tenancy/cohort";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import { FieldGroup } from "@repo/design-system/components/ui/field";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { buttonVariants } from "@repo/design-system/lib/button";
import { Array as Arr, Option, Schema } from "effect";
import { createContext, use, useId, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import {
  TableFiltersProvider,
  TableSearch,
} from "@/components/shared/table/toolbar";
import { EmptyState } from "@/components/state/empty";
import { EmptyNina } from "@/components/state/nina";
import { WithAction } from "@/components/tenant/action";
import { useTenant, useViewerQuery } from "@/components/tenant/context";
import { SchoolHeaderAdd } from "@/components/tenant/header";
import { ReadBoundary } from "@/components/tenant/read/boundary";
import { isDenied } from "@/components/tenant/refusal";
import { chosenGrade } from "@/components/tenant/settings/choices";
import {
  CohortGradeField,
  CohortNameField,
} from "@/components/tenant/settings/cohort/fields";
import { CohortLevelContext } from "@/components/tenant/settings/cohort/level";
import { SchoolCohortTable } from "@/components/tenant/settings/cohort/table";
import { createCohortChange } from "@/components/tenant/settings/groups";
import { saveSchool } from "@/components/tenant/settings/save";
import { SettingsTablePage } from "@/components/tenant/settings/section";
import type { Period } from "@/components/tenant/settings/state";
import {
  SchoolUnitChoice,
  type UnitId,
} from "@/components/tenant/settings/unit";
import { NoActiveUnit } from "@/components/tenant/settings/unitless";
import { Link } from "@/lib/routing/link";

const SOURCE = "components/tenant/settings/cohorts";

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
      <CohortLevelContext value={unit.level}>
        <SchoolCohortsOfUnit />
      </CohortLevelContext>
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
        <EmptyState
          description={t("cohorts-unavailable-description")}
          scene={<EmptyNina act="pointing" />}
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
        <EmptyState
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
          scene={<EmptyNina act="pointing" />}
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
        action={
          <Button
            disabled={periodId === null || !isComplete || isPending}
            inert={isPending}
            onClick={submit}
            type="button"
          >
            {t("cohort-create")}
          </Button>
        }
        description={
          hasNoPeriod ? t("cohort-add-no-period") : t("cohort-add-footer")
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
