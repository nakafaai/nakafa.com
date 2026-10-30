import { FunctionSpec, GroupSpec } from "@confect/core";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { TenantAccess } from "@repo/backend/confect/access/tenant";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * What the school home still needs from the school's setup, for the owner and the admin: whether the
 * school holds an active teacher, an active student, and an invite that waits to be accepted.
 */
const HomeSetup = Schema.Struct({
  hasPendingInvite: Schema.Boolean,
  hasStudent: Schema.Boolean,
  hasTeacher: Schema.Boolean,
});

/** The setup the school home shows its owner and admin, which only a viewer who manages the school reads. */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicQuery({
      name: "setup",
      args: () => ({ slug: TenantSlug }),
      returns: () => HomeSetup,
      error: () => AccessDenied,
    }).middleware(TenantAccess, { action: "tenant.manage" })
  );
