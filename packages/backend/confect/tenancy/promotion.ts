import { Id } from "@repo/backend/confect/_generated/id";
import { CohortGrade, CohortName } from "@repo/backend/confect/tenancy/cohort";
import {
  CohortHasHomeroom,
  CohortLimit,
  CohortNameTaken,
  PeriodActive,
  PersonAlreadyPlaced,
  PersonNotStudent,
  PersonNotTeacher,
  PersonPlacementLimit,
  PromotionCohortOccupied,
  PromotionPlanInvalid,
  SourcePeriodInvalid,
  TeacherHasHomeroom,
} from "@repo/backend/confect/tenancy/errors";
import type { UnitLevel } from "@repo/backend/confect/tenancy/schema";
import { Array as Arr, Option, Schema } from "effect";

/**
 * A promotion's state. A draft or submitted plan is edited, an approved one waits
 * to be applied, an applied one runs its steps, and an opened one is final, as is
 * a cancelled one.
 */
export const PromotionStatus = Schema.Literals([
  "draft",
  "submitted",
  "approved",
  "applied",
  "opened",
  "cancelled",
]);

/** The four steps of applying a promotion, in the order they run. */
export const PromotionStep = Schema.Literals([
  "archive",
  "cohorts",
  "place",
  "homeroom",
]);

/** Why the principal returned a submitted plan: reason codes only, never free text. */
export const PromotionReturnReason = Schema.Literals([
  "cohorts",
  "students",
  "homeroom",
  "other",
]);

/**
 * Every typed failure a step may stop with. The stored failure of a promotion and the
 * error type of a step both come from this list, so a new failure is added once.
 */
export const PROMOTION_STEP_FAILURES = [
  CohortHasHomeroom,
  CohortLimit,
  CohortNameTaken,
  PeriodActive,
  PersonAlreadyPlaced,
  PersonNotStudent,
  PersonNotTeacher,
  PersonPlacementLimit,
  PromotionCohortOccupied,
  PromotionPlanInvalid,
  SourcePeriodInvalid,
  TeacherHasHomeroom,
];

/** A typed failure that stopped a step, kept on the promotion so the wizard shows where it stopped. */
const PromotionFailure = Schema.Union(
  Arr.map(PROMOTION_STEP_FAILURES, (failure) => failure.fields._tag)
);

/** Any typed failure a step may stop with. */
export type PromotionStepFailure =
  (typeof PROMOTION_STEP_FAILURES)[number]["Type"];

/**
 * Where a student goes: a cohort of the plan by its name, graduation, or `stay`,
 * the cohort of the target period that has the name and grade of the student's
 * own cohort, for a student who repeats the year.
 */
export const PromotionDestination = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("cohort"), name: CohortName }),
  Schema.Struct({ kind: Schema.Literal("graduate") }),
  Schema.Struct({ kind: Schema.Literal("stay") }),
]).pipe(Schema.toTaggedUnion("kind"));

/** One new cohort of the target period, which applying the promotion creates. */
export const PromotionTarget = Schema.Struct({
  grade: CohortGrade,
  name: CohortName,
});

/**
 * Where the students of one cohort of the source period go, and whether that
 * cohort's homeroom teacher is copied to the cohort they join.
 */
export const PromotionSource = Schema.Struct({
  cohortId: Id("tenantCohorts"),
  homeroom: Schema.Boolean,
  to: PromotionDestination,
});

/** A cohort that applying the promotion created, keyed by the name its plan gives it. */
export const PromotionCreated = Schema.Struct({
  cohortId: Id("tenantCohorts"),
  nameKey: Schema.String,
});

/**
 * Where applying or undoing stands. A step that stops keeps its step and cursor,
 * so the next run resumes at the page that stopped. `done` lists the steps that
 * completed, in order.
 */
export const PromotionProgress = Schema.Struct({
  cursor: Schema.NullOr(Schema.String),
  direction: Schema.NullOr(Schema.Literals(["apply", "undo"])),
  done: Schema.Array(PromotionStep),
  failure: Schema.NullOr(PromotionFailure),
  running: Schema.Boolean,
  step: Schema.NullOr(PromotionStep),
});

/** The progress of a promotion no step runs for and none has stopped at. */
export const IDLE_PROGRESS: typeof PromotionProgress.Type = {
  cursor: null,
  direction: null,
  done: [],
  failure: null,
  running: false,
  step: null,
};

/** The step that follows each step; the last step has none. */
const NEXT_STEP: Record<
  typeof PromotionStep.Type,
  typeof PromotionStep.Type | undefined
> = {
  archive: "cohorts",
  cohorts: "place",
  homeroom: undefined,
  place: "homeroom",
};

/** The step that follows another in applying a promotion, if any. */
export const nextStepOf = (step: typeof PromotionStep.Type) =>
  Option.fromUndefinedOr(NEXT_STEP[step]);

/** The states a promotion holds while it still counts for its source and target periods. */
export const LIVE_PROMOTION_STATES: readonly (typeof PromotionStatus.Type)[] = [
  "draft",
  "submitted",
  "approved",
  "applied",
];

/**
 * A promotion of one source period to a target period of the same unit. Its plan
 * is the targets and sources, and `created` and `copies` hold what applying it
 * wrote, so undo removes exactly those rows. Its `unitId` lets a student's
 * graduation be found by unit and Person.
 */
export const tenantPromotionValidator = Schema.Struct({
  copies: Schema.Array(Id("tenantAssignments")),
  created: Schema.Array(PromotionCreated),
  progress: PromotionProgress,
  returnReason: Schema.NullOr(PromotionReturnReason),
  sourcePeriodId: Id("tenantPeriods"),
  sources: Schema.Array(PromotionSource),
  state: PromotionStatus,
  targetPeriodId: Id("tenantPeriods"),
  targets: Schema.Array(PromotionTarget),
  tenantId: Id("tenants"),
  unitId: Id("tenantUnits"),
});

/** A student whose destination differs from the one their cohort gives. Students without one follow their cohort. */
export const tenantPromotionMoveValidator = Schema.Struct({
  personId: Id("tenantPeople"),
  promotionId: Id("tenantPromotions"),
  tenantId: Id("tenants"),
  to: PromotionDestination,
});

/**
 * Students one step page reads and writes, so one transaction stays small. The
 * chain runs one page after another until the last student is placed.
 */
export const PROMOTION_PAGE_SIZE = 100;

/**
 * The last grade of each unit level: the grade whose students graduate. SD and MI
 * end at grade 6, SMP and MTs at 9, and SMA, MA, and SMK at 12. Levels without a
 * last grade, such as PAUD, SLB, and other, have none, so their students cannot
 * graduate through a promotion.
 */
const LAST_GRADE: Record<typeof UnitLevel.Type, number | undefined> = {
  ma: 12,
  mi: 6,
  mts: 9,
  other: undefined,
  paud: undefined,
  sd: 6,
  sma: 12,
  smk: 12,
  smp: 9,
  slb: undefined,
};

/** The last grade of a unit level, if its students can graduate. */
export const lastGradeOf = (level: typeof UnitLevel.Type) =>
  Option.fromUndefinedOr(LAST_GRADE[level]);

/**
 * Where a run in one direction starts from a promotion's progress, if it can start,
 * and which steps are done when it does. A stopped run resumes at its own step and
 * page. Applying from idle starts the step after the last one done, and undoing from
 * idle undoes the last one done. A stopped apply can be undone, which undoes the
 * steps it finished. A stopped place step that had finished a page also undoes the
 * placements of those pages first, so the cohorts they fill do not block the undo.
 * Nothing starts while a run is in flight, or when a stopped undo must finish before
 * applying.
 */
export const resumePoint = (
  progress: typeof PromotionProgress.Type,
  direction: "apply" | "undo"
) => {
  if (progress.running) {
    return Option.none();
  }
  if (progress.step !== null && progress.failure !== null) {
    if (progress.direction === direction) {
      return Option.some({
        cursor: progress.cursor,
        done: progress.done,
        step: progress.step,
      });
    }
    if (direction === "apply") {
      return Option.none();
    }
    if (
      progress.direction === "apply" &&
      progress.step === "place" &&
      progress.cursor !== null
    ) {
      const partial: typeof PromotionStep.Type = "place";
      return Option.some({
        cursor: null,
        done: Arr.append(progress.done, partial),
        step: partial,
      });
    }
  }
  const last = Arr.last(progress.done);
  if (direction === "undo") {
    return Option.map(last, (step) => ({
      cursor: null,
      done: progress.done,
      step,
    }));
  }
  return Option.map(Option.flatMap(last, nextStepOf), (step) => ({
    cursor: null,
    done: progress.done,
    step,
  }));
};

/** Whether applying a promotion finished: its last step is done and no run is in flight. */
export const applyFinished = (progress: typeof PromotionProgress.Type) =>
  !progress.running &&
  progress.failure === null &&
  Option.exists(Arr.last(progress.done), (step) =>
    Option.isNone(nextStepOf(step))
  );

/**
 * The step where an apply stopped before any step finished, if it did. Undoing such
 * an apply undoes no step and only returns the plan to approved, because the stopped
 * step wrote nothing before it stopped.
 */
export const stoppedBeforeAnyStep = (
  progress: typeof PromotionProgress.Type
) =>
  progress.direction === "apply" &&
  !progress.running &&
  progress.failure !== null &&
  progress.done.length === 0
    ? Option.fromNullishOr(progress.step)
    : Option.none();
