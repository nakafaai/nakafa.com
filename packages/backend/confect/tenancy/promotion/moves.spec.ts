import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { PromotionAccess } from "@repo/backend/confect/tenancy/access";
import {
  PersonNotPlaced,
  PromotionPlanInvalid,
  PromotionState,
} from "@repo/backend/confect/tenancy/errors";
import { PromotionDestination } from "@repo/backend/confect/tenancy/promotion/schema";
import { PromotionView } from "@repo/backend/confect/tenancy/promotion/view";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** One student whose destination the plan sets apart from the destination of their cohort. */
const PromotionMoveView = Schema.Struct({
  personId: Id("tenantPeople"),
  to: PromotionDestination,
});

/**
 * The destinations of single students in a promotion's plan: the Admin sets,
 * replaces, or clears one student's destination, and lists the ones that differ.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicMutation({
      name: "setMove",
      args: () => ({
        personId: Id("tenantPeople"),
        promotionId: Id("tenantPromotions"),
        slug: TenantSlug,
        to: Schema.NullOr(PromotionDestination),
      }),
      returns: () => PromotionView,
      error: () =>
        Schema.Union([
          AccessDenied,
          PersonNotPlaced,
          PromotionPlanInvalid,
          PromotionState,
        ]),
    }).middleware(PromotionAccess, {
      action: "promotion.prepare",
      arg: "promotionId",
    })
  )
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "moves",
      args: () => ({
        promotionId: Id("tenantPromotions"),
        slug: TenantSlug,
      }),
      item: () => PromotionMoveView,
      error: () => AccessDenied,
    }).middleware(PromotionAccess, {
      action: "promotion.view",
      arg: "promotionId",
    })
  );
