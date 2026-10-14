import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import {
  PeriodAccess,
  PromotionAccess,
} from "@repo/backend/confect/tenancy/access";
import {
  CohortNameTaken,
  PersonNotPlaced,
  PromotionPlanInvalid,
  PromotionState,
  SourcePeriodInvalid,
  TargetPeriodInvalid,
} from "@repo/backend/confect/tenancy/errors";
import {
  PromotionDestination,
  PromotionSource,
  PromotionTarget,
} from "@repo/backend/confect/tenancy/promotion";
import { PromotionView } from "@repo/backend/confect/tenancy/promotionView";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** One student whose destination the plan sets apart from the destination of their cohort. */
const PromotionMoveView = Schema.Struct({
  personId: Id("tenantPeople"),
  to: PromotionDestination,
});

/**
 * The plan of one school period's promotion to the next one: the Admin creates
 * it, writes its plan and the destinations of single students, and reads them.
 * Review and the steps that apply it are other groups.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicQuery({
      name: "get",
      args: () => ({ periodId: Id("tenantPeriods"), slug: TenantSlug }),
      returns: () => Schema.NullOr(PromotionView),
      error: () => AccessDenied,
    }).middleware(PeriodAccess, { action: "period.view", arg: "periodId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "create",
      args: () => ({
        periodId: Id("tenantPeriods"),
        slug: TenantSlug,
        targetPeriodId: Id("tenantPeriods"),
      }),
      returns: () => PromotionView,
      error: () =>
        Schema.Union([
          AccessDenied,
          PromotionState,
          SourcePeriodInvalid,
          TargetPeriodInvalid,
        ]),
    }).middleware(PeriodAccess, { action: "period.manage", arg: "periodId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "plan",
      args: () => ({
        promotionId: Id("tenantPromotions"),
        slug: TenantSlug,
        sources: Schema.Array(PromotionSource),
        targets: Schema.Array(PromotionTarget),
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
