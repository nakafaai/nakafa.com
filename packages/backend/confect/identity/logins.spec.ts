import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { TenantAccess } from "@repo/backend/confect/access/tenant";
import {
  LoginMissing,
  LoginNameRefused,
  LoginNameTaken,
} from "@repo/backend/confect/identity/errors";
import {
  LoginName,
  LoginUsername,
} from "@repo/backend/confect/identity/schema";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { PersonAccess } from "@repo/backend/confect/tenancy/access";
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

/**
 * The school logins of one school, read by its Admin, who renames one through the
 * person's card right, and the username that a school login signs in with on the school's host. `usernameOf` is internal: the host's sign-in
 * calls it with no session, because its visitor is signed out (ADR 0009).
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "list",
      args: () => ({
        search: Schema.optionalKey(PersonName),
        slug: TenantSlug,
      }),
      item: () => LoginView,
      error: () => AccessDenied,
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(TenantAccess, { action: "tenant.manage" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "rename",
      args: () => ({
        loginName: Schema.String,
        personId: Id("tenantPeople"),
        slug: TenantSlug,
      }),
      returns: () => LoginName,
      error: () =>
        Schema.Union([
          AccessDenied,
          LoginMissing,
          LoginNameRefused,
          LoginNameTaken,
        ]),
    })
      .middleware(Session)
      .middleware(RequireMember)
      .middleware(PersonAccess, { action: "card.issue", arg: "personId" })
  )
  .addFunction(
    FunctionSpec.internalQuery({
      name: "usernameOf",
      args: () => ({ loginName: Schema.String, slug: TenantSlug }),
      returns: () => LoginUsername,
    })
  );
