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
  promotionAuthority,
} from "@repo/backend/confect/tenancy/authority";
import {
  COHORT_LIMIT,
  cohortNameKey,
} from "@repo/backend/confect/tenancy/cohort";
import {
  CohortLimit,
  PromotionCohortOccupied,
} from "@repo/backend/confect/tenancy/errors";
import { targetNamesFree } from "@repo/backend/confect/tenancy/promotion/check";
import { finished } from "@repo/backend/confect/tenancy/promotion/progress";
import { update } from "@repo/backend/confect/tenancy/promotion/row";
import { Array as Arr, Effect, Option } from "effect";

/**
 * Creates one active cohort of the target period for each target, and keeps the
 * IDs on the promotion. The names and the count are checked before the first
 * write, so a refusal leaves no cohort behind.
 */
export const cohortsApply = Effect.fn("tenancy.promotion.cohorts.apply")(
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
    yield* update(promotion, { created });
    return finished;
  }
);

/**
 * Whether a cohort the promotion created still holds a Person or a homeroom
 * teacher. Undo refuses to delete such a cohort, because its rows would be lost.
 */
const isOccupied = Effect.fn("tenancy.promotion.cohorts.occupied")(function* (
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
export const cohortsUndo = Effect.fn("tenancy.promotion.cohorts.undo")(
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
    yield* update(promotion, { created: [] });
    return finished;
  }
);
