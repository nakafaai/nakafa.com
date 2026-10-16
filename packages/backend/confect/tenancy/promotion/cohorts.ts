import type { GenericId } from "@confect/core";
import type { TenantPromotionsDoc } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type { TenantActor } from "@repo/backend/confect/journal/schema";
import {
  activeHomeroomOf,
  promotionAuthority,
} from "@repo/backend/confect/tenancy/authority";
import { PromotionCohortOccupied } from "@repo/backend/confect/tenancy/errors";
import { finished } from "@repo/backend/confect/tenancy/promotion/progress";
import { update } from "@repo/backend/confect/tenancy/promotion/row";
import { clearRemovedHomeroom } from "@repo/backend/confect/tenancy/write/assignment";
import {
  checkCohorts,
  insertCohort,
} from "@repo/backend/confect/tenancy/write/cohort";
import { Array as Arr, Effect, Option } from "effect";

/**
 * Creates one active cohort of the target period for each target, and keeps the
 * IDs on the promotion. The write checks the names and the count before the first
 * insert, so a refusal leaves no cohort behind.
 */
export const cohortsApply = Effect.fn("tenancy.promotion.cohorts.apply")(
  function* (
    promotion: TenantPromotionsDoc,
    actor: typeof TenantActor.Type,
    _cursor: string | null
  ) {
    const period = {
      _id: promotion.targetPeriodId,
      tenantId: promotion.tenantId,
      unitId: promotion.unitId,
    };
    yield* checkCohorts(period, promotion.targets);
    const cohorts = yield* Effect.forEach(promotion.targets, (target) =>
      insertCohort(actor, period, target)
    );
    yield* update(promotion, {
      created: Arr.map(cohorts, (cohort) => ({
        cohortId: cohort._id,
        nameKey: cohort.nameKey,
      })),
    });
    return finished;
  }
);

/**
 * Whether a cohort the promotion created still holds a Person or an active homeroom
 * teacher, or a class, active or archived. Undo refuses to delete such a cohort. A
 * removed teacher's row does not count: undo clears it with the cohort.
 */
const isOccupied = Effect.fn("tenancy.promotion.cohorts.occupied")(function* (
  cohortId: GenericId.GenericId<"tenantCohorts">
) {
  const reader = yield* DatabaseReader;
  const holder = yield* reader
    .table("tenantCohortMembers")
    .index("by_cohortId_and_personId", (query) =>
      query.eq("cohortId", cohortId)
    )
    .first()
    .pipe(Effect.orDie);
  const homeroom = yield* activeHomeroomOf(cohortId);
  const classOfCohort = yield* reader
    .table("classes")
    .index("by_cohortId_and_status_and_nameKey", (query) =>
      query.eq("cohortId", cohortId)
    )
    .first()
    .pipe(Effect.orDie);
  return (
    Option.isSome(holder) ||
    Option.isSome(homeroom) ||
    Option.isSome(classOfCohort)
  );
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
    const reader = yield* DatabaseReader;
    yield* Effect.forEach(
      promotion.created,
      (entry) =>
        Effect.gen(function* () {
          const cohort = yield* reader
            .table("tenantCohorts")
            .get(entry.cohortId)
            .pipe(Effect.orDie);
          yield* clearRemovedHomeroom(actor, cohort);
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
