import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { TenantAccess } from "@repo/backend/confect/access/tenant";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { LogoAnswer, LogoType } from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The logo of a school, which only its Owner and its Admin change. `uploadUrl`
 * answers the address that a file is uploaded to. `set` names the uploaded file
 * and its type, and checks the type in its arguments. It answers a value, not a
 * failure, because a refused file is deleted and the delete must commit: a failed
 * mutation rolls its writes back. `remove` deletes the logo and its file.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicMutation({
      name: "uploadUrl",
      args: () => ({ slug: TenantSlug }),
      returns: () => Schema.URLFromString,
    }).middleware(TenantAccess, { action: "tenant.manage" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "set",
      args: () => ({
        contentType: LogoType,
        slug: TenantSlug,
        storageId: Id("_storage"),
      }),
      returns: () => LogoAnswer,
    }).middleware(TenantAccess, { action: "tenant.manage" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "remove",
      args: () => ({ slug: TenantSlug }),
      returns: () => Schema.Struct({}),
    }).middleware(TenantAccess, { action: "tenant.manage" })
  );
