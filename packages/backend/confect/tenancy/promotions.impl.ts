import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import type {
  TenantPeriodsDoc,
  TenantPromotionsDoc,
} from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { Period, Promotion } from "@repo/backend/confect/tenancy/access";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import {
  periodAccess,
  placementOf,
  promotionAccess,
  promotionAuthority,
} from "@repo/backend/confect/tenancy/authority";
import {
  PersonNotPlaced,
  PromotionPlanInvalid,
  PromotionState,
  SourcePeriodInvalid,
  TargetPeriodInvalid,
} from "@repo/backend/confect/tenancy/errors";
import {
  IDLE_PROGRESS,
  lastGradeOf,
  type PromotionDestination,
} from "@repo/backend/confect/tenancy/promotion";
import {
  liveForSource,
  liveForTarget,
  shownForSource,
} from "@repo/backend/confect/tenancy/promotionFind";
import {
  checkPlan,
  destinationIssue,
  targetNamesFree,
} from "@repo/backend/confect/tenancy/promotionPlan";
import {
  PLANNABLE,
  planOf,
  update,
  view,
} from "@repo/backend/confect/tenancy/promotionRow";
import spec from "@repo/backend/confect/tenancy/promotions.spec";
import { Array as Arr, Effect, Layer, Option, Struct } from "effect";

/** Reads one period of the tenant by ID; a period of another tenant or none at all is `None`. */
const readPeriod = (periodId: TenantPeriodsDoc["_id"]) =>
  Effect.flatMap(DatabaseReader, (reader) =>
    reader
      .table("tenantPeriods")
      .get(periodId)
      .pipe(
        Effect.asSome,
        Effect.catchTag("GetByIdFailure", () => Effect.succeedNone),
        Effect.orDie
      )
  );

/**
 * Whether a period is a planned target of a source period: the same unit, planned,
 * and starting after the source period ends. Dates are calendar dates, so text
 * order is date order.
 */
const isTargetOf = (source: TenantPeriodsDoc, target: TenantPeriodsDoc) =>
  target.unitId === source.unitId &&
  target.status === "planned" &&
  target.start > source.end;

/** Lists the promotion of a school period, the one the wizard shows: never a cancelled one. */
const get = FunctionImpl.make(
  databaseSchema,
  spec,
  "get",
  Effect.fn("tenancy.promotions.get")(function* () {
    const period = yield* Period;
    const shown = yield* shownForSource(period._id);
    return Option.match(shown, { onNone: () => null, onSome: view });
  })
);

/**
 * Starts a promotion of an active school period to a planned period of the same
 * school that starts after it ends. A period has one live promotion at a time, and
 * a target period is the target of one live promotion at a time.
 */
const create = FunctionImpl.make(
  databaseSchema,
  spec,
  "create",
  Effect.fn("tenancy.promotions.create")(function* ({ targetPeriodId }) {
    const { person } = yield* Member;
    const period = yield* Period;
    if (period.status !== "active") {
      return yield* new SourcePeriodInvalid();
    }
    if (Option.isSome(yield* liveForSource(period._id))) {
      return yield* new PromotionState();
    }
    const target = yield* readPeriod(targetPeriodId);
    if (Option.isNone(target) || !isTargetOf(period, target.value)) {
      return yield* new TargetPeriodInvalid();
    }
    if (Option.isSome(yield* liveForTarget(target.value._id))) {
      return yield* new TargetPeriodInvalid();
    }
    const promotionId = yield* (yield* DatabaseWriter)
      .table("tenantPromotions")
      .insert({
        copies: [],
        created: [],
        progress: IDLE_PROGRESS,
        returnReason: null,
        sourcePeriodId: period._id,
        sources: [],
        state: "draft",
        targetPeriodId: target.value._id,
        targets: [],
        tenantId: period.tenantId,
        unitId: period.unitId,
      })
      .pipe(Effect.orDie);
    const promotion = yield* (yield* DatabaseReader)
      .table("tenantPromotions")
      .get(promotionId)
      .pipe(Effect.orDie);
    yield* promotionAuthority.record(personActor(person), promotion, {
      type: "promotion.created",
    });
    return view(promotion);
  })
);

/**
 * Replaces the plan of a promotion: its new cohorts and what each source cohort
 * becomes. The plan must fit the source period as it is now, and its names must be
 * free in the target period. Editing a submitted or approved plan sends it back to
 * draft, so the principal approves what is applied.
 */
const plan = FunctionImpl.make(
  databaseSchema,
  spec,
  "plan",
  Effect.fn("tenancy.promotions.plan")(function* ({ sources, targets }) {
    const { person } = yield* Member;
    const promotion = yield* Promotion;
    if (!Arr.contains(PLANNABLE, promotion.state)) {
      return yield* new PromotionState();
    }
    yield* checkPlan({ ...planOf(promotion), sources, targets });
    yield* targetNamesFree(promotion.targetPeriodId, targets);
    const next = yield* update(promotion, {
      returnReason: null,
      sources,
      state: "draft",
      targets,
    });
    yield* promotionAuthority.record(personActor(person), promotion, {
      type: "promotion.planned",
    });
    return view(next);
  })
);

/** Writes one student's move: sets it, replaces it, or clears it when `to` is `null`. */
const writeMove = Effect.fn("tenancy.promotions.writeMove")(function* (
  promotion: TenantPromotionsDoc,
  personId: GenericId.GenericId<"tenantPeople">,
  to: typeof PromotionDestination.Type | null
) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const existing = yield* reader
    .table("tenantPromotionMoves")
    .get("by_promotionId_and_personId", promotion._id, personId)
    .pipe(
      Effect.asSome,
      Effect.catchTag("GetByIndexFailure", () => Effect.succeedNone),
      Effect.orDie
    );
  if (to === null) {
    if (Option.isSome(existing)) {
      yield* writer
        .table("tenantPromotionMoves")
        .delete(existing.value._id)
        .pipe(Effect.orDie);
    }
    return;
  }
  if (Option.isSome(existing)) {
    yield* writer
      .table("tenantPromotionMoves")
      .patch(existing.value._id, { to })
      .pipe(Effect.orDie);
    return;
  }
  yield* writer
    .table("tenantPromotionMoves")
    .insert({
      personId,
      promotionId: promotion._id,
      tenantId: promotion.tenantId,
      to,
    })
    .pipe(Effect.orDie);
});

/**
 * Sets or clears one student's destination in the plan. A destination must fit the
 * cohort the student is in now: a cohort of the plan, a repeated year, or
 * graduation in the last grade of the unit.
 */
const setMove = FunctionImpl.make(
  databaseSchema,
  spec,
  "setMove",
  Effect.fn("tenancy.promotions.setMove")(function* ({ personId, to }) {
    const { person } = yield* Member;
    const promotion = yield* Promotion;
    if (!Arr.contains(PLANNABLE, promotion.state)) {
      return yield* new PromotionState();
    }
    const placed = yield* placementOf(promotion.sourcePeriodId, personId);
    if (Option.isNone(placed)) {
      return yield* new PersonNotPlaced();
    }
    if (to !== null) {
      const reader = yield* DatabaseReader;
      const cohort = yield* reader
        .table("tenantCohorts")
        .get(placed.value.cohortId)
        .pipe(Effect.orDie);
      const unit = yield* reader
        .table("tenantUnits")
        .get(promotion.unitId)
        .pipe(Effect.orDie);
      const issue = destinationIssue(
        promotion.targets,
        cohort,
        to,
        lastGradeOf(unit.level)
      );
      if (Option.isSome(issue)) {
        return yield* new PromotionPlanInvalid({ reason: issue.value });
      }
    }
    yield* writeMove(promotion, personId, to);
    const next = yield* update(promotion, {
      returnReason: null,
      state: "draft",
    });
    yield* promotionAuthority.record(personActor(person), promotion, {
      person: personId,
      type: "promotion.studentPlanned",
    });
    return view(next);
  })
);

/** One page of the students whose destination the plan sets apart from their cohort's. */
const moves = FunctionImpl.make(
  databaseSchema,
  spec,
  "moves",
  Effect.fn("tenancy.promotions.moves")(function* ({ paginationOpts }) {
    const promotion = yield* Promotion;
    const page = yield* (yield* DatabaseReader)
      .table("tenantPromotionMoves")
      .index("by_promotionId_and_personId", (query) =>
        query.eq("promotionId", promotion._id)
      )
      .paginate(paginationOpts)
      .pipe(Effect.orDie);
    return Struct.assign(page, {
      page: Arr.map(page.page, (move) => ({
        personId: move.personId,
        to: move.to,
      })),
    });
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(get),
  Layer.provide(create),
  Layer.provide(plan),
  Layer.provide(setMove),
  Layer.provide(moves),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(periodAccess),
  Layer.provide(promotionAccess),
  GroupImpl.finalize
);
