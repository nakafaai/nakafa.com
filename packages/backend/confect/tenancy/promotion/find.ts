import type { GenericId } from "@confect/core";
import type { TenantPromotionsDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  LIVE_PROMOTION_STATES,
  type PromotionStatus,
} from "@repo/backend/confect/tenancy/promotion/schema";
import { Array as Arr, Effect, Option } from "effect";

/** The promotion of a source period in one state, if there is one. */
const bySource = (
  sourcePeriodId: GenericId.GenericId<"tenantPeriods">,
  state: typeof PromotionStatus.Type
) =>
  Effect.flatMap(DatabaseReader, (reader) =>
    reader
      .table("tenantPromotions")
      .index("by_sourcePeriodId_and_state", (query) =>
        query.eq("sourcePeriodId", sourcePeriodId).eq("state", state)
      )
      .first()
      .pipe(Effect.orDie)
  );

/** The promotion that targets a period in one state, if there is one. */
const byTarget = (
  targetPeriodId: GenericId.GenericId<"tenantPeriods">,
  state: typeof PromotionStatus.Type
) =>
  Effect.flatMap(DatabaseReader, (reader) =>
    reader
      .table("tenantPromotions")
      .index("by_targetPeriodId_and_state", (query) =>
        query.eq("targetPeriodId", targetPeriodId).eq("state", state)
      )
      .first()
      .pipe(Effect.orDie)
  );

/**
 * The first promotion that a list of states finds. A period holds at most one
 * promotion in a live state, so the order of the states only decides which one a
 * period shows when it holds an opened one as well.
 */
const firstIn = <R>(
  states: readonly (typeof PromotionStatus.Type)[],
  read: (
    state: typeof PromotionStatus.Type
  ) => Effect.Effect<Option.Option<TenantPromotionsDoc>, never, R>
) =>
  Effect.map(Effect.forEach(states, read), (found) =>
    Option.flatten(Arr.findFirst(found, Option.isSome))
  );

/** The live promotion of a source period: draft through applied, never cancelled. */
export const liveForSource = Effect.fn("tenancy.promotion.find.liveForSource")(
  function* (sourcePeriodId: GenericId.GenericId<"tenantPeriods">) {
    return yield* firstIn(LIVE_PROMOTION_STATES, (state) =>
      bySource(sourcePeriodId, state)
    );
  }
);

/** The promotion of a source period that the wizard shows: live, or opened once its target opened. */
export const shownForSource = Effect.fn(
  "tenancy.promotion.find.shownForSource"
)(function* (sourcePeriodId: GenericId.GenericId<"tenantPeriods">) {
  return yield* firstIn([...LIVE_PROMOTION_STATES, "opened"], (state) =>
    bySource(sourcePeriodId, state)
  );
});

/** The live promotion that targets a period, if one does. */
export const liveForTarget = Effect.fn("tenancy.promotion.find.liveForTarget")(
  function* (targetPeriodId: GenericId.GenericId<"tenantPeriods">) {
    return yield* firstIn(LIVE_PROMOTION_STATES, (state) =>
      byTarget(targetPeriodId, state)
    );
  }
);
