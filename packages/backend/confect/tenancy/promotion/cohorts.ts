import type { TenantPromotionsDoc } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type { TenantActor } from "@repo/backend/confect/journal/schema";
import { promotionAuthority } from "@repo/backend/confect/tenancy/authority";
import { PromotionCohortOccupied } from "@repo/backend/confect/tenancy/errors";
import { finished } from "@repo/backend/confect/tenancy/promotion/progress";
import { update } from "@repo/backend/confect/tenancy/promotion/row";
import { clearRemovedHomeroom } from "@repo/backend/confect/tenancy/write/assignment";
import {
  checkCohorts,
  insertCohort,
} from "@repo/backend/confect/tenancy/write/cohort";
import { cohortHold } from "@repo/backend/confect/tenancy/write/holds";
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
 * Deletes the cohorts that applying the promotion created, while none is in use (`cohortHold`): a removed teacher's
 * row does not count, and undo clears it with the cohort.
 */
export const cohortsUndo = Effect.fn("tenancy.promotion.cohorts.undo")(
  function* (
    promotion: TenantPromotionsDoc,
    actor: typeof TenantActor.Type,
    _cursor: string | null
  ) {
    const holds = yield* Effect.forEach(promotion.created, (entry) =>
      cohortHold(entry.cohortId)
    );
    if (Arr.some(holds, Option.isSome)) {
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
