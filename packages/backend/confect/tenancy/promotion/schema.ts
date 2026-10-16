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
import { Array as Arr, Schema } from "effect";

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
const PROMOTION_STEP_FAILURES = [
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
