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
import { PromotionView } from "@repo/backend/confect/tenancy/promotion/view";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * Applying an approved promotion, which starts its four steps. The steps run one
 * page or one step at a time in `run`, and undoing them is `undo`.
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
  );
