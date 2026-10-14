import type { GenericId } from "@confect/core";
import type { TenantPromotionsDoc } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type { TenantActor } from "@repo/backend/confect/journal/schema";
import {
  cohortAuthority,
  homeroomOf,
  homeroomOfPerson,
  periodAuthority,
  promotionAuthority,
} from "@repo/backend/confect/tenancy/authority";
import {
  COHORT_LIMIT,
  cohortNameKey,
} from "@repo/backend/confect/tenancy/cohort";
import {
  CohortHasHomeroom,
  CohortLimit,
  type CohortNameTaken,
  PeriodActive,
  type PersonAlreadyPlaced,
  type PersonNotStudent,
  type PersonPlacementLimit,
  PromotionCohortOccupied,
  type PromotionPlanInvalid,
  SourcePeriodInvalid,
  TeacherHasHomeroom,
} from "@repo/backend/confect/tenancy/errors";
import type { PeriodStatus } from "@repo/backend/confect/tenancy/period";
import type { PromotionSource } from "@repo/backend/confect/tenancy/promotion";
import {
  targetNamesFree,
  targetOf,
} from "@repo/backend/confect/tenancy/promotionPlan";
import { Array as Arr, Effect, Option, Schema, Struct } from "effect";

/** What one run of a step left: whether it read its last page, and where the next page starts. */
export const StepOutcome = Schema.Struct({
  complete: Schema.Boolean,
  cursor: Schema.NullOr(Schema.String),
});

/** The outcome of a step that finished in one run. */
const finished: typeof StepOutcome.Type = { complete: true, cursor: null };

/** Every typed failure a step may stop with. A stopped run keeps the failure's tag on its promotion. */
export type PromotionStepFailure =
  | CohortHasHomeroom
  | CohortLimit
  | CohortNameTaken
  | PeriodActive
  | PersonAlreadyPlaced
  | PersonNotStudent
  | PersonPlacementLimit
  | PromotionCohortOccupied
  | PromotionPlanInvalid
  | SourcePeriodInvalid
  | TeacherHasHomeroom;

/** The active source period of a promotion, which the first step archives. */
const readSourcePeriod = Effect.fn("tenancy.promotionSteps.source")(function* (
  promotion: TenantPromotionsDoc
) {
  return yield* (yield* DatabaseReader)
    .table("tenantPeriods")
    .get(promotion.sourcePeriodId)
    .pipe(Effect.orDie);
});

/** Archives the active source period, the first step of applying a promotion. */
export const archiveApply = Effect.fn("tenancy.promotionSteps.archiveApply")(
  function* (
    promotion: TenantPromotionsDoc,
    actor: typeof TenantActor.Type,
    _cursor: string | null
  ) {
    const period = yield* readSourcePeriod(promotion);
    if (period.status !== "active") {
      return yield* new SourcePeriodInvalid();
    }
    const status: typeof PeriodStatus.Type = "archived";
    yield* (yield* DatabaseWriter)
      .table("tenantPeriods")
      .replace(
        period._id,
        Struct.assign(Struct.omit(period, ["_creationTime", "_id"]), { status })
      )
      .pipe(Effect.orDie);
    yield* periodAuthority.record(actor, period, { type: "period.archived" });
    return finished;
  }
);

/**
 * Makes the archived source period active again, the inverse of archiving it. Only
 * an applied promotion undoes this. It is refused while another period of the unit
 * is active: a unit has at most one active period, and the source stays archived
 * until this undo, so an active period is one opened while the promotion ran.
 */
export const archiveUndo = Effect.fn("tenancy.promotionSteps.archiveUndo")(
  function* (
    promotion: TenantPromotionsDoc,
    actor: typeof TenantActor.Type,
    _cursor: string | null
  ) {
    const period = yield* readSourcePeriod(promotion);
    const active = yield* (yield* DatabaseReader)
      .table("tenantPeriods")
      .index("by_unitId_and_status", (query) =>
        query.eq("unitId", promotion.unitId).eq("status", "active")
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.isSome(active)) {
      return yield* new PeriodActive();
    }
    const status: typeof PeriodStatus.Type = "active";
    yield* (yield* DatabaseWriter)
      .table("tenantPeriods")
      .replace(
        period._id,
        Struct.assign(Struct.omit(period, ["_creationTime", "_id"]), { status })
      )
      .pipe(Effect.orDie);
    yield* promotionAuthority.record(actor, promotion, {
      step: "archive",
      type: "promotion.undone",
    });
    return finished;
  }
);

/**
 * Creates one active cohort of the target period for each target, and keeps the
 * IDs on the promotion. The names and the count are checked before the first
 * write, so a refusal leaves no cohort behind.
 */
export const cohortsApply = Effect.fn("tenancy.promotionSteps.cohortsApply")(
  function* (
    promotion: TenantPromotionsDoc,
    actor: typeof TenantActor.Type,
    _cursor: string | null
  ) {
    const reader = yield* DatabaseReader;
    yield* targetNamesFree(promotion.targetPeriodId, promotion.targets);
    const existing = yield* reader
      .table("tenantCohorts")
      .index("by_periodId_and_grade_and_nameKey", (query) =>
        query.eq("periodId", promotion.targetPeriodId)
      )
      .take(COHORT_LIMIT)
      .pipe(Effect.orDie);
    if (existing.length + promotion.targets.length > COHORT_LIMIT) {
      return yield* new CohortLimit();
    }
    const created = yield* Effect.forEach(promotion.targets, (target) =>
      Effect.gen(function* () {
        const nameKey = cohortNameKey(target.name);
        const cohortId = yield* (yield* DatabaseWriter)
          .table("tenantCohorts")
          .insert({
            grade: target.grade,
            name: target.name,
            nameKey,
            periodId: promotion.targetPeriodId,
            status: "active",
            tenantId: promotion.tenantId,
            unitId: promotion.unitId,
          })
          .pipe(Effect.orDie);
        const cohort = yield* reader
          .table("tenantCohorts")
          .get(cohortId)
          .pipe(Effect.orDie);
        yield* cohortAuthority.record(actor, cohort, {
          type: "cohort.created",
        });
        return { cohortId, nameKey };
      })
    );
    yield* patchPromotion(promotion, { created });
    return finished;
  }
);

/**
 * Whether a cohort the promotion created still holds a Person or a homeroom
 * teacher. Undo refuses to delete such a cohort, because its rows would be lost.
 */
const isOccupied = Effect.fn("tenancy.promotionSteps.occupied")(function* (
  cohortId: GenericId.GenericId<"tenantCohorts">
) {
  const holder = yield* (yield* DatabaseReader)
    .table("tenantCohortMembers")
    .index("by_cohortId_and_personId", (query) =>
      query.eq("cohortId", cohortId)
    )
    .first()
    .pipe(Effect.orDie);
  const homeroom = yield* homeroomOf(cohortId);
  return Option.isSome(holder) || Option.isSome(homeroom);
});

/** Deletes the cohorts that applying the promotion created, while none holds anyone. */
export const cohortsUndo = Effect.fn("tenancy.promotionSteps.cohortsUndo")(
  function* (
    promotion: TenantPromotionsDoc,
    actor: typeof TenantActor.Type,
    _cursor: string | null
  ) {
    const occupied = yield* Effect.forEach(promotion.created, (entry) =>
      isOccupied(entry.cohortId)
    );
    if (Arr.some(occupied, (busy) => busy)) {
      return yield* new PromotionCohortOccupied();
    }
    yield* Effect.forEach(
      promotion.created,
      (entry) =>
        Effect.gen(function* () {
          yield* (yield* DatabaseWriter)
            .table("tenantCohorts")
            .delete(entry.cohortId)
            .pipe(Effect.orDie);
          yield* promotionAuthority.record(actor, promotion, {
            step: "cohorts",
            type: "promotion.undone",
          });
        }),
      { discard: true }
    );
    yield* patchPromotion(promotion, { created: [] });
    return finished;
  }
);

/**
 * Plans the copy of one source cohort's homeroom teacher to the cohort their
 * students join. A source cohort without a homeroom teacher plans nothing.
 */
const planCopy = Effect.fn("tenancy.promotionSteps.planCopy")(function* (
  promotion: TenantPromotionsDoc,
  entry: typeof PromotionSource.Type
) {
  const assignment = yield* homeroomOf(entry.cohortId);
  if (Option.isNone(assignment)) {
    return [];
  }
  const reader = yield* DatabaseReader;
  const source = yield* reader
    .table("tenantCohorts")
    .get(entry.cohortId)
    .pipe(Effect.orDie);
  // The plan check named a cohort for every homeroom copy, and the cohorts step
  // created each named cohort, so the target is always there.
  const cohortId = Option.getOrThrow(
    targetOf(promotion.created, entry.to, source.name)
  );
  const taken = yield* homeroomOf(cohortId);
  if (Option.isSome(taken)) {
    return yield* new CohortHasHomeroom();
  }
  const busy = yield* homeroomOfPerson(
    promotion.targetPeriodId,
    assignment.value.personId
  );
  if (Option.isSome(busy)) {
    return yield* new TeacherHasHomeroom();
  }
  return [{ cohortId, personId: assignment.value.personId }];
});

/**
 * Copies each homeroom teacher the plan names to the cohort its students join, in
 * the target period. Every copy is checked against the rows and against the other
 * copies of the plan before the first write, so a refusal writes nothing.
 */
export const homeroomApply = Effect.fn("tenancy.promotionSteps.homeroomApply")(
  function* (
    promotion: TenantPromotionsDoc,
    actor: typeof TenantActor.Type,
    _cursor: string | null
  ) {
    const planned = yield* Effect.forEach(
      Arr.filter(promotion.sources, (entry) => entry.homeroom),
      (entry) => planCopy(promotion, entry)
    );
    const copies = Arr.flatten(planned);
    const cohortIds = Arr.map(copies, (copy) => copy.cohortId);
    if (Arr.dedupe(cohortIds).length !== cohortIds.length) {
      return yield* new CohortHasHomeroom();
    }
    const copied = yield* Effect.forEach(copies, (copy) =>
      writeCopy(promotion, actor, copy)
    );
    yield* patchPromotion(promotion, { copies: copied });
    return finished;
  }
);

/** Writes one homeroom copy, and journals it on the cohort it joins. */
const writeCopy = Effect.fn("tenancy.promotionSteps.writeCopy")(function* (
  promotion: TenantPromotionsDoc,
  actor: typeof TenantActor.Type,
  copy: {
    readonly cohortId: GenericId.GenericId<"tenantCohorts">;
    readonly personId: GenericId.GenericId<"tenantPeople">;
  }
) {
  const reader = yield* DatabaseReader;
  const assignmentId = yield* (yield* DatabaseWriter)
    .table("tenantAssignments")
    .insert({
      cohortId: copy.cohortId,
      kind: "homeroom",
      periodId: promotion.targetPeriodId,
      personId: copy.personId,
      tenantId: promotion.tenantId,
    })
    .pipe(Effect.orDie);
  const cohort = yield* reader
    .table("tenantCohorts")
    .get(copy.cohortId)
    .pipe(Effect.orDie);
  yield* cohortAuthority.record(actor, cohort, {
    assignment: "homeroom",
    person: copy.personId,
    type: "assignment.created",
  });
  return assignmentId;
});

/** Deletes the homeroom copies that apply made, and that still exist. */
export const homeroomUndo = Effect.fn("tenancy.promotionSteps.homeroomUndo")(
  function* (
    promotion: TenantPromotionsDoc,
    actor: typeof TenantActor.Type,
    _cursor: string | null
  ) {
    const reader = yield* DatabaseReader;
    yield* Effect.forEach(
      promotion.copies,
      (assignmentId) =>
        Effect.gen(function* () {
          const copy = yield* reader
            .table("tenantAssignments")
            .get(assignmentId)
            .pipe(
              Effect.asSome,
              Effect.catchTag("GetByIdFailure", () => Effect.succeedNone),
              Effect.orDie
            );
          if (Option.isNone(copy)) {
            return;
          }
          yield* (yield* DatabaseWriter)
            .table("tenantAssignments")
            .delete(copy.value._id)
            .pipe(Effect.orDie);
          yield* promotionAuthority.record(actor, promotion, {
            step: "homeroom",
            type: "promotion.undone",
          });
        }),
      { discard: true }
    );
    yield* patchPromotion(promotion, { copies: [] });
    return finished;
  }
);

/** Replaces the fields of one promotion row, keeping its other fields as they are. */
const patchPromotion = (
  promotion: TenantPromotionsDoc,
  fields: Partial<Pick<TenantPromotionsDoc, "copies" | "created">>
) =>
  Effect.flatMap(DatabaseWriter, (writer) =>
    writer
      .table("tenantPromotions")
      .patch(promotion._id, fields)
      .pipe(Effect.orDie)
  );
