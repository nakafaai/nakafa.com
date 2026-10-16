import type { TenantPromotionsDoc } from "@repo/backend/confect/_generated/docs";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  PromotionProgress,
  PromotionReturnReason,
  PromotionSource,
  PromotionStatus,
  PromotionTarget,
} from "@repo/backend/confect/tenancy/promotion/schema";
import { Schema } from "effect";

/** One promotion as the wizard shows it: its plan, its state, and how far its run got. */
export const PromotionView = Schema.Struct({
  id: Id("tenantPromotions"),
  progress: PromotionProgress,
  returnReason: Schema.NullOr(PromotionReturnReason),
  sourcePeriodId: Id("tenantPeriods"),
  sources: Schema.Array(PromotionSource),
  state: PromotionStatus,
  targetPeriodId: Id("tenantPeriods"),
  targets: Schema.Array(PromotionTarget),
});

/** One promotion as the wire shows it. */
export const view = (promotion: TenantPromotionsDoc) => ({
  id: promotion._id,
  progress: promotion.progress,
  returnReason: promotion.returnReason,
  sourcePeriodId: promotion.sourcePeriodId,
  sources: promotion.sources,
  state: promotion.state,
  targetPeriodId: promotion.targetPeriodId,
  targets: promotion.targets,
});
