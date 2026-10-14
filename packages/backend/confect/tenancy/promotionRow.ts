import type { TenantPromotionsDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import type { PromotionStatus } from "@repo/backend/confect/tenancy/promotion";
import { Effect, Struct } from "effect";

/** The states a plan may be edited in: a draft, a submitted plan, and an approved one that edits send back to draft. */
export const PLANNABLE: readonly (typeof PromotionStatus.Type)[] = [
  "draft",
  "submitted",
  "approved",
];

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

/** The fields of a promotion that the plan check reads. */
export const planOf = (promotion: TenantPromotionsDoc) => ({
  sourcePeriodId: promotion.sourcePeriodId,
  sources: promotion.sources,
  targets: promotion.targets,
  unitId: promotion.unitId,
});

/** Patches fields of one promotion and returns the row as it now reads. */
export const update = <F extends Partial<TenantPromotionsDoc>>(
  promotion: TenantPromotionsDoc,
  fields: F
) =>
  Effect.flatMap(DatabaseWriter, (writer) =>
    writer
      .table("tenantPromotions")
      .patch(promotion._id, fields)
      .pipe(Effect.orDie, Effect.as(Struct.assign(promotion, fields)))
  );
