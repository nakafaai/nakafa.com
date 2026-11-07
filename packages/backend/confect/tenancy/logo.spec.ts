import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { TenantAccess } from "@repo/backend/confect/access/tenant";
import { StorageFull } from "@repo/backend/confect/bucket/errors";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import {
  LogoAnswer,
  LogoReservation,
  LogoType,
} from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The logo of a school, which only its Owner and its Admin change. `reserve`
 * charges the file's bytes and answers the R2 address it is uploaded to, which
 * binds its length and type, or refuses a file over the logo limit before any
 * byte moves. `set` names the uploaded file. `remove` deletes the logo and its
 * file.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicMutation({
      name: "reserve",
      args: () => ({
        byteSize: Schema.Int.check(Schema.isGreaterThan(0)),
        contentType: LogoType,
        slug: TenantSlug,
      }),
      returns: () => LogoReservation,
      error: () => StorageFull,
    }).middleware(TenantAccess, { action: "tenant.manage" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "set",
      args: () => ({ fileId: Id("bucketFiles"), slug: TenantSlug }),
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
