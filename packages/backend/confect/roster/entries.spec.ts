import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Nisn, RosterView } from "@repo/backend/confect/roster/schema";
import { PersonAccess } from "@repo/backend/confect/tenancy/access";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The roster row of one student: its NISN and its under-age flag. The school's
 * Admin and Staff set it by hand, and each roster import sets it again (ADR 0034).
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicMutation({
      name: "set",
      args: () => ({
        nisn: Schema.optionalKey(Nisn),
        personId: Id("tenantPeople"),
        slug: TenantSlug,
        underAgeLimit: Schema.Boolean,
      }),
      returns: () => RosterView,
      error: () => AccessDenied,
    }).middleware(PersonAccess, { action: "roster.manage", arg: "personId" })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "get",
      args: () => ({ personId: Id("tenantPeople"), slug: TenantSlug }),
      returns: () => RosterView,
      error: () => AccessDenied,
    }).middleware(PersonAccess, { action: "roster.view", arg: "personId" })
  );
