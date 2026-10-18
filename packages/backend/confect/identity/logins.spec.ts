import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { TenantAccess } from "@repo/backend/confect/access/tenant";
import { LoginName } from "@repo/backend/confect/identity/schema";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { PersonName } from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * One school login as the school's Admin lists it: the login name, the Person
 * it belongs to, and when the school issued it. No password and no card code
 * leaves the server.
 */
const LoginView = Schema.Struct({
  issuedAt: Schema.Finite,
  loginName: LoginName,
  person: Schema.Struct({ id: Id("tenantPeople"), name: PersonName }),
});

/** The school logins of one school, read by its Admin. */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "list",
      args: () => ({ slug: TenantSlug }),
      item: () => LoginView,
      error: () => AccessDenied,
    }).middleware(TenantAccess, { action: "tenant.manage" })
  );
