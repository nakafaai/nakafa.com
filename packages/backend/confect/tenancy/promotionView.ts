import { Id } from "@repo/backend/confect/_generated/id";
import {
  PromotionProgress,
  PromotionReturnReason,
  PromotionSource,
  PromotionStatus,
  PromotionTarget,
} from "@repo/backend/confect/tenancy/promotion";
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
