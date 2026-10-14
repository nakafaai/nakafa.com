import type { GenericId } from "@confect/core";
import refs from "@repo/backend/confect/_generated/refs";
import { Scheduler } from "@repo/backend/confect/_generated/services";
import { Duration, Effect } from "effect";

/**
 * Schedules the next run of a promotion, which applies or undoes its next page or
 * step. The run starts after the current transaction commits.
 */
export const scheduleRun = Effect.fn("tenancy.promotionSchedule.run")(
  function* (
    actorId: GenericId.GenericId<"tenantPeople">,
    promotionId: GenericId.GenericId<"tenantPromotions">
  ) {
    yield* (yield* Scheduler).runAfter(
      Duration.zero,
      refs.internal.tenancy.promotionRun.run,
      { actorId, promotionId }
    );
  }
);
