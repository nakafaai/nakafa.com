import type { GenericId } from "@confect/core";
import type {
  TenantCohortMembersDoc,
  TenantCohortsDoc,
  TenantPeopleDoc,
  TenantPromotionsDoc,
} from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type { TenantActor } from "@repo/backend/confect/journal/schema";
import {
  personAuthority,
  placementOf,
  promotionAuthority,
  studentOf,
} from "@repo/backend/confect/tenancy/authority";
import {
  PersonAlreadyPlaced,
  PersonNotStudent,
  PersonPlacementLimit,
  PromotionPlanInvalid,
} from "@repo/backend/confect/tenancy/errors";
import { PERSON_PLACEMENT_LIMIT } from "@repo/backend/confect/tenancy/placement";
import {
  lastGradeOf,
  PROMOTION_PAGE_SIZE,
} from "@repo/backend/confect/tenancy/promotion";
import {
  destinationIssue,
  targetOf,
} from "@repo/backend/confect/tenancy/promotionPlan";
import { Array as Arr, Effect, Option } from "effect";

/** One page of the source period's placements, read in placement order. */
const sourcePage = Effect.fn("tenancy.promotionPlace.sourcePage")(function* (
  promotion: TenantPromotionsDoc,
  cursor: string | null
) {
  return yield* (yield* DatabaseReader)
    .table("tenantCohortMembers")
    .index("by_periodId_and_personId", (query) =>
      query.eq("periodId", promotion.sourcePeriodId)
    )
    .paginate({ cursor, numItems: PROMOTION_PAGE_SIZE })
    .pipe(Effect.orDie);
});

/** The source cohorts of one page, each read once however many of its students are on the page. */
const cohortsOf = (
  placements: readonly TenantCohortMembersDoc[]
): Effect.Effect<readonly TenantCohortsDoc[], never, DatabaseReader> =>
  Effect.forEach(
    Arr.dedupe(Arr.map(placements, (placement) => placement.cohortId)),
    (cohortId) =>
      Effect.flatMap(DatabaseReader, (reader) =>
        reader.table("tenantCohorts").get(cohortId).pipe(Effect.orDie)
      )
  );

/**
 * The source cohort of a placement, read once for the page it is on. The page's
 * placements name every cohort that is read, so the lookup always finds one.
 */
const cohortIn = Effect.fn("tenancy.promotionPlace.cohortIn")(function* (
  cohorts: readonly TenantCohortsDoc[],
  cohortId: GenericId.GenericId<"tenantCohorts">
) {
  return yield* Effect.fromOption(
    Arr.findFirst(cohorts, (cohort) => cohort._id === cohortId)
  ).pipe(Effect.orDie);
});

/**
 * The checks every destination needs: the Person is a student of the unit, and
 * holds no place in the target period yet. A graduate needs them too, so a placement
 * that someone made by hand in the target period stops the promotion before it writes.
 */
const checkStudent = Effect.fn("tenancy.promotionPlace.checkStudent")(
  function* (
    promotion: TenantPromotionsDoc,
    placement: TenantCohortMembersDoc,
    cohort: TenantCohortsDoc
  ) {
    if (!(yield* studentOf(placement.personId, cohort.unitId))) {
      return yield* new PersonNotStudent();
    }
    if (
      Option.isSome(
        yield* placementOf(promotion.targetPeriodId, placement.personId)
      )
    ) {
      return yield* new PersonAlreadyPlaced();
    }
  }
);

/**
 * The check that a new placement in the target period fits the placement limit. A
 * graduate gets no new placement, so only a cohort destination runs it.
 */
const checkRoom = Effect.fn("tenancy.promotionPlace.checkRoom")(function* (
  personId: GenericId.GenericId<"tenantPeople">
) {
  const held = yield* (yield* DatabaseReader)
    .table("tenantCohortMembers")
    .index("by_personId", (query) => query.eq("personId", personId))
    .take(PERSON_PLACEMENT_LIMIT)
    .pipe(Effect.orDie);
  if (held.length >= PERSON_PLACEMENT_LIMIT) {
    return yield* new PersonPlacementLimit();
  }
});

/**
 * Where one student of the source period goes, checked against the target period
 * before any write. A student's own move wins over the destination of their cohort.
 * The destination must fit the cohort the student is in now, so a move set for an
 * earlier cohort stops the promotion rather than graduating a student who moved.
 */
const planStudent = Effect.fn("tenancy.promotionPlace.planStudent")(function* (
  promotion: TenantPromotionsDoc,
  placement: TenantCohortMembersDoc,
  cohorts: readonly TenantCohortsDoc[],
  lastGrade: Option.Option<number>
) {
  const reader = yield* DatabaseReader;
  const cohort = yield* cohortIn(cohorts, placement.cohortId);
  const entry = Arr.findFirst(
    promotion.sources,
    (source) => source.cohortId === placement.cohortId
  );
  if (Option.isNone(entry)) {
    return yield* new PromotionPlanInvalid({ reason: "sources" });
  }
  const move = yield* reader
    .table("tenantPromotionMoves")
    .get("by_promotionId_and_personId", promotion._id, placement.personId)
    .pipe(
      Effect.asSome,
      Effect.catchTag("GetByIndexFailure", () => Effect.succeedNone),
      Effect.orDie
    );
  const to = Option.match(move, {
    onNone: () => entry.value.to,
    onSome: (found) => found.to,
  });
  const issue = destinationIssue(promotion.targets, cohort, to, lastGrade);
  if (Option.isSome(issue)) {
    return yield* new PromotionPlanInvalid({ reason: issue.value });
  }
  yield* checkStudent(promotion, placement, cohort);
  const person = yield* reader
    .table("tenantPeople")
    .get(placement.personId)
    .pipe(Effect.orDie);
  const target = targetOf(promotion.created, to, cohort.name);
  if (to.kind === "graduate") {
    return { cohort, person, target: Option.none() };
  }
  // The destination check above named a target of the plan, and the cohorts step
  // created every target, so the target is always there.
  const cohortId = yield* Effect.fromOption(target).pipe(Effect.orDie);
  yield* checkRoom(placement.personId);
  return { cohort, person, target: Option.some(cohortId) };
});

/**
 * Writes one student's move or graduation, and journals it on the Person. `plan`
 * holds the student's cohort, the Person, and the cohort they join, or `None` when
 * they graduate.
 */
const writeStudent = Effect.fn("tenancy.promotionPlace.writeStudent")(
  function* (
    promotion: TenantPromotionsDoc,
    actor: typeof TenantActor.Type,
    placement: TenantCohortMembersDoc,
    plan: {
      readonly cohort: TenantCohortsDoc;
      readonly person: TenantPeopleDoc;
      readonly target: Option.Option<GenericId.GenericId<"tenantCohorts">>;
    }
  ) {
    const writer = yield* DatabaseWriter;
    if (Option.isNone(plan.target)) {
      yield* writer
        .table("tenantGraduates")
        .insert({
          personId: placement.personId,
          promotionId: promotion._id,
          tenantId: promotion.tenantId,
          unitId: plan.cohort.unitId,
        })
        .pipe(Effect.orDie);
      yield* personAuthority.record(actor, plan.person, {
        promotion: promotion._id,
        type: "person.graduated",
      });
      return;
    }
    yield* writer
      .table("tenantCohortMembers")
      .insert({
        cohortId: plan.target.value,
        periodId: promotion.targetPeriodId,
        personId: placement.personId,
        tenantId: promotion.tenantId,
      })
      .pipe(Effect.orDie);
    yield* personAuthority.record(actor, plan.person, {
      from: placement.cohortId,
      to: plan.target.value,
      type: "person.moved",
    });
  }
);

/**
 * Places one page of the source period's students in their destinations. Every
 * student of the page is checked first, so a refusal writes nothing and the page
 * resumes from the same cursor.
 */
export const placeApply = Effect.fn("tenancy.promotionPlace.apply")(function* (
  promotion: TenantPromotionsDoc,
  actor: typeof TenantActor.Type,
  cursor: string | null
) {
  const unit = yield* (yield* DatabaseReader)
    .table("tenantUnits")
    .get(promotion.unitId)
    .pipe(Effect.orDie);
  const lastGrade = lastGradeOf(unit.level);
  const page = yield* sourcePage(promotion, cursor);
  const cohorts = yield* cohortsOf(page.page);
  const plans = yield* Effect.forEach(page.page, (placement) =>
    planStudent(promotion, placement, cohorts, lastGrade).pipe(
      Effect.map((plan) => ({ placement, plan }))
    )
  );
  yield* Effect.forEach(
    plans,
    ({ placement, plan }) => writeStudent(promotion, actor, placement, plan),
    { discard: true }
  );
  return { complete: page.isDone, cursor: page.continueCursor };
});

/** Removes one student's placement in the target period and their graduation, if apply made them. */
const undoStudent = Effect.fn("tenancy.promotionPlace.undoStudent")(function* (
  promotion: TenantPromotionsDoc,
  actor: typeof TenantActor.Type,
  personId: GenericId.GenericId<"tenantPeople">
) {
  const writer = yield* DatabaseWriter;
  const reader = yield* DatabaseReader;
  const placed = yield* placementOf(promotion.targetPeriodId, personId);
  if (Option.isSome(placed)) {
    yield* writer
      .table("tenantCohortMembers")
      .delete(placed.value._id)
      .pipe(Effect.orDie);
    yield* promotionAuthority.record(actor, promotion, {
      step: "place",
      type: "promotion.undone",
    });
  }
  const graduated = yield* reader
    .table("tenantGraduates")
    .get("by_unitId_and_personId", promotion.unitId, personId)
    .pipe(
      Effect.asSome,
      Effect.catchTag("GetByIndexFailure", () => Effect.succeedNone),
      Effect.orDie
    );
  if (Option.isSome(graduated)) {
    yield* writer
      .table("tenantGraduates")
      .delete(graduated.value._id)
      .pipe(Effect.orDie);
    yield* promotionAuthority.record(actor, promotion, {
      step: "place",
      type: "promotion.undone",
    });
  }
});

/**
 * Undoes the placements of one page of the source period's students: the target
 * placement of each student and their graduation, which apply wrote. A placement
 * of one of them that someone made by hand in the target period meanwhile is
 * removed too, because nothing locks the period while its promotion is applied.
 */
export const placeUndo = Effect.fn("tenancy.promotionPlace.undo")(function* (
  promotion: TenantPromotionsDoc,
  actor: typeof TenantActor.Type,
  cursor: string | null
) {
  const page = yield* sourcePage(promotion, cursor);
  yield* Effect.forEach(
    page.page,
    (placement) => undoStudent(promotion, actor, placement.personId),
    { discard: true }
  );
  return { complete: page.isDone, cursor: page.continueCursor };
});
