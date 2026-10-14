import type { GenericId } from "@confect/core";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import type { TenantActor } from "@repo/backend/confect/journal/schema";
import { promotionAuthority } from "@repo/backend/confect/tenancy/authority";
import { PromotionState } from "@repo/backend/confect/tenancy/errors";
import {
  applyFinished,
  type PromotionStatus,
} from "@repo/backend/confect/tenancy/promotion";
import { liveForTarget } from "@repo/backend/confect/tenancy/promotionFind";
import { Effect, Option } from "effect";

/**
 * Opens a planned period as the school's Admin does. A promotion that still plans
 * or runs toward the period refuses it. An applied promotion whose steps all
 * finished is opened instead: its state becomes final, and undo ends.
 */
export const openTarget = Effect.fn("tenancy.promotionOpen.target")(function* (
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
  const state: typeof PromotionStatus.Type = "opened";
  yield* (yield* DatabaseWriter)
    .table("tenantPromotions")
    .patch(promotion._id, { state })
    .pipe(Effect.orDie);
  yield* promotionAuthority.record(actor, promotion, {
    type: "promotion.opened",
  });
});
