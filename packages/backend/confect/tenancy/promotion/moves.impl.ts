import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import type { TenantPromotionsDoc } from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { Promotion } from "@repo/backend/confect/tenancy/access";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import {
  personAuthority,
  placementOf,
  promotionAccess,
  promotionAuthority,
} from "@repo/backend/confect/tenancy/authority";
import {
  PersonNotPlaced,
  PromotionPlanInvalid,
  PromotionState,
} from "@repo/backend/confect/tenancy/errors";
import {
  destinationIssue,
  lastGradeOf,
} from "@repo/backend/confect/tenancy/promotion/destination";
import spec from "@repo/backend/confect/tenancy/promotion/moves.spec";
import { PLANNABLE, update } from "@repo/backend/confect/tenancy/promotion/row";
import type { PromotionDestination } from "@repo/backend/confect/tenancy/promotion/schema";
import { view } from "@repo/backend/confect/tenancy/promotion/view";
import { Array as Arr, Effect, Layer, Option, Struct } from "effect";

/** Writes one student's move: sets it, replaces it, or clears it when `to` is `null`. */
const writeMove = Effect.fn("tenancy.promotion.moves.write")(function* (
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
  Effect.fn("tenancy.promotion.moves.setMove")(function* ({ personId, to }) {
    const { person } = yield* Member;
    const promotion = yield* Promotion;
    if (!Arr.contains(PLANNABLE, promotion.state)) {
      return yield* new PromotionState();
    }
    yield* personAuthority.authorize("person.manage", personId);
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
  Effect.fn("tenancy.promotion.moves.list")(function* ({ paginationOpts }) {
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
  Layer.provide(setMove),
  Layer.provide(moves),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(promotionAccess),
  GroupImpl.finalize
);
