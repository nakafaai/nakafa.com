import type { TenantPromotionsDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import type { PromotionStatus } from "@repo/backend/confect/tenancy/promotion/schema";
import { Effect, Struct } from "effect";

/** The states a plan may be edited in: a draft, a submitted plan, and an approved one that edits send back to draft. */
export const PLANNABLE: readonly (typeof PromotionStatus.Type)[] = [
  "draft",
  "submitted",
  "approved",
];

/** The fields of a promotion that the plan check reads. */
export const planOf = (promotion: TenantPromotionsDoc) => ({
  sourcePeriodId: promotion.sourcePeriodId,
  sources: promotion.sources,
  targets: promotion.targets,
  unitId: promotion.unitId,
});

/** Patches fields of one promotion and returns the row as it now reads. */
export const update = Effect.fn("tenancy.promotion.row.update")(function* <
  F extends Partial<TenantPromotionsDoc>,
>(promotion: TenantPromotionsDoc, fields: F) {
  yield* (yield* DatabaseWriter)
    .table("tenantPromotions")
    .patch(promotion._id, fields)
    .pipe(Effect.orDie);
  return Struct.assign(promotion, fields);
});
