import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { PromotionAccess } from "@repo/backend/confect/tenancy/access";
import { PromotionState } from "@repo/backend/confect/tenancy/errors";
import { PromotionView } from "@repo/backend/confect/tenancy/promotion/view";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * Undoing an applied promotion one step at a time, back to approved. Undo is
 * refused once the target period opens, because the promotion is then locked.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
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
