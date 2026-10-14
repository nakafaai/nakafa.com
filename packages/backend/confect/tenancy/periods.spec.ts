import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { PeriodAccess } from "@repo/backend/confect/tenancy/access";
import {
  PeriodActive,
  PeriodDatesInvalid,
  PeriodNotActive,
  PeriodOverlaps,
} from "@repo/backend/confect/tenancy/errors";
import { PeriodName, PeriodStatus } from "@repo/backend/confect/tenancy/period";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** One period as the wire shows it. Its dates are calendar dates of its school's clock. */
const PeriodView = Schema.Struct({
  end: Schema.String,
  id: Id("tenantPeriods"),
  name: PeriodName,
  start: Schema.String,
  status: PeriodStatus,
});

/**
 * The periods of a school. Its Admin creates, opens, and archives them; the
 * roles that read the school's plan read them, and an archived school or period
 * refuses every write.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "list",
      args: () => ({ slug: TenantSlug, unitId: Id("tenantUnits") }),
      item: () => PeriodView,
      error: () => AccessDenied,
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "create",
      args: () => ({
        end: Schema.String,
        name: PeriodName,
        slug: TenantSlug,
        start: Schema.String,
        unitId: Id("tenantUnits"),
      }),
      returns: () => PeriodView,
      error: () =>
        Schema.Union([AccessDenied, PeriodDatesInvalid, PeriodOverlaps]),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "open",
      args: () => ({ periodId: Id("tenantPeriods"), slug: TenantSlug }),
      returns: () => PeriodView,
      error: () => Schema.Union([AccessDenied, PeriodActive]),
    }).middleware(PeriodAccess, { action: "period.manage", arg: "periodId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "archive",
      args: () => ({ periodId: Id("tenantPeriods"), slug: TenantSlug }),
      returns: () => PeriodView,
      error: () => Schema.Union([AccessDenied, PeriodNotActive]),
    }).middleware(PeriodAccess, { action: "period.manage", arg: "periodId" })
  );
