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
} from "@repo/backend/confect/tenancy/errors";
import { PromotionReturnReason } from "@repo/backend/confect/tenancy/promotion";
import { PromotionView } from "@repo/backend/confect/tenancy/promotionView";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The review of a promotion's plan: the Admin submits a draft, the principal
 * approves a submitted plan or returns it, and either of them may cancel a plan
 * that is not applied yet.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicMutation({
      name: "submit",
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
        ]),
    }).middleware(PromotionAccess, {
      action: "promotion.prepare",
      arg: "promotionId",
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "approve",
      args: () => ({
        promotionId: Id("tenantPromotions"),
        slug: TenantSlug,
      }),
      returns: () => PromotionView,
      error: () => Schema.Union([AccessDenied, PromotionState]),
    }).middleware(PromotionAccess, {
      action: "promotion.approve",
      arg: "promotionId",
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "returnToDraft",
      args: () => ({
        promotionId: Id("tenantPromotions"),
        reason: PromotionReturnReason,
        slug: TenantSlug,
      }),
      returns: () => PromotionView,
      error: () => Schema.Union([AccessDenied, PromotionState]),
    }).middleware(PromotionAccess, {
      action: "promotion.approve",
      arg: "promotionId",
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "cancel",
      args: () => ({
        promotionId: Id("tenantPromotions"),
        slug: TenantSlug,
      }),
      returns: () => PromotionView,
      error: () => Schema.Union([AccessDenied, PromotionState]),
    }).middleware(PromotionAccess, {
      action: "promotion.prepare",
      arg: "promotionId",
    })
  );
