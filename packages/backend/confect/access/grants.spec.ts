import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { GrantAccess } from "@repo/backend/confect/access/access";
import {
  AccessDenied,
  GrantRejected,
} from "@repo/backend/confect/access/errors";
import {
  BuiltinRole,
  GrantScope,
  RoleRef,
} from "@repo/backend/confect/access/schema";
import { TenantAccess } from "@repo/backend/confect/access/tenant";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { PersonAccess } from "@repo/backend/confect/tenancy/access";
import { PersonName } from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * One active grant of the school as its Admin lists it: the Person who holds
 * it, the role, the scope, which is the whole school or one unit, and whether
 * ending it leaves the school an Owner who has signed in.
 */
const GrantRow = Schema.Struct({
  id: Id("tenantGrants"),
  person: Schema.Struct({ id: Id("tenantPeople"), name: PersonName }),
  revocable: Schema.Boolean,
  role: RoleRef,
  scope: GrantScope,
});

export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicPaginatedQuery({
      name: "list",
      args: () => ({ slug: TenantSlug }),
      item: () => GrantRow,
      error: () => AccessDenied,
    }).middleware(TenantAccess, { action: "tenant.manage" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "assign",
      args: () => ({
        personId: Id("tenantPeople"),
        role: BuiltinRole,
        scope: GrantScope,
        slug: TenantSlug,
      }),
      returns: () => Id("tenantGrants"),
      error: () => Schema.Union([GrantRejected, AccessDenied]),
    }).middleware(PersonAccess, { action: "person.view", arg: "personId" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "revoke",
      args: () => ({ grantId: Id("tenantGrants"), slug: TenantSlug }),
      returns: () => Schema.Null,
      error: () => Schema.Union([GrantRejected, AccessDenied]),
    }).middleware(GrantAccess, { action: "grant.view", arg: "grantId" })
  );
