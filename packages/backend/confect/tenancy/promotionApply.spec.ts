import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { PromotionAccess } from "@repo/backend/confect/tenancy/access";
import {
  CohortNameTaken,
  PromotionPlanInvalid,
  PromotionState,
  SourcePeriodInvalid,
} from "@repo/backend/confect/tenancy/errors";
import { PromotionView } from "@repo/backend/confect/tenancy/promotionView";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * Applying an approved promotion, which starts its steps, and undoing an applied
 * one, which takes back its last step. The steps themselves run in `promotionRun`.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicMutation({
      name: "apply",
      args: () => ({
        promotionId: Id("tenantPromotions"),
        slug: TenantSlug,
      }),
      returns: () => PromotionView,
      error: () =>
        Schema.Union([
          AccessDenied,
          CohortNameTaken,
          PromotionPlanInvalid,
          PromotionState,
          SourcePeriodInvalid,
        ]),
    }).middleware(PromotionAccess, {
      action: "promotion.apply",
      arg: "promotionId",
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "undo",
      args: () => ({
        promotionId: Id("tenantPromotions"),
        slug: TenantSlug,
      }),
      returns: () => PromotionView,
      error: () => Schema.Union([AccessDenied, PromotionState]),
    }).middleware(PromotionAccess, {
      action: "promotion.apply",
      arg: "promotionId",
    })
  );
