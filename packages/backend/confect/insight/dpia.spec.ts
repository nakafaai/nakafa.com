import { FunctionSpec, GroupSpec } from "@confect/core";
import { TenantAccess } from "@repo/backend/confect/access/tenant";
import { DpiaFields, DpiaView } from "@repo/backend/confect/insight/schema";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** A school's impact assessment (ADR 0035): the one in force, and the record that switches Insight on. */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicQuery({
      name: "get",
      args: () => ({ slug: TenantSlug }),
      returns: () => Schema.NullOr(DpiaView),
    }).middleware(TenantAccess, { action: "insight.dpia" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "record",
      args: () => ({ ...DpiaFields, slug: TenantSlug }),
      returns: () => Schema.Null,
    }).middleware(TenantAccess, { action: "insight.dpia" })
  );
