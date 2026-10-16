import type { GenericId } from "@confect/core";
import type { TenantActor } from "@repo/backend/confect/journal/schema";
import { promotionAuthority } from "@repo/backend/confect/tenancy/authority";
import { PromotionState } from "@repo/backend/confect/tenancy/errors";
import { liveForTarget } from "@repo/backend/confect/tenancy/promotion/find";
import { applyFinished } from "@repo/backend/confect/tenancy/promotion/progress";
import { update } from "@repo/backend/confect/tenancy/promotion/row";
import { Effect, Option } from "effect";

/**
 * Opens a planned period as the school's Admin does. A promotion that still plans
 * or runs toward the period refuses it. An applied promotion whose steps all
 * finished is opened instead: its state becomes final, and undo ends.
 */
export const openTarget = Effect.fn("tenancy.promotion.open.target")(function* (
  actor: typeof TenantActor.Type,
  periodId: GenericId.GenericId<"tenantPeriods">
) {
  const live = yield* liveForTarget(periodId);
  if (Option.isNone(live)) {
    return;
  }
  const promotion = live.value;
  if (promotion.state !== "applied" || !applyFinished(promotion.progress)) {
    return yield* new PromotionState();
  }
  yield* update(promotion, { state: "opened" });
  yield* promotionAuthority.record(actor, promotion, {
    type: "promotion.opened",
  });
});
