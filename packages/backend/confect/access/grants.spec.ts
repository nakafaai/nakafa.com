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
  GrantView,
} from "@repo/backend/confect/access/schema";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { PersonAccess } from "@repo/backend/confect/tenancy/access";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicQuery({
      name: "list",
      args: () => ({ personId: Id("tenantPeople"), slug: TenantSlug }),
      returns: () => Schema.Array(GrantView),
    }).middleware(PersonAccess, { action: "person.view", arg: "personId" })
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
