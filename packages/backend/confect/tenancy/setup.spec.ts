import { FunctionSpec, GroupSpec } from "@confect/core";
import { TenantAccess } from "@repo/backend/confect/access/tenant";
import RequireMember from "@repo/backend/confect/middleware/member.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** Which steps of the setup the school's own data already shows as done. */
export const SetupState = Schema.Struct({
  cohort: Schema.Boolean,
  exam: Schema.Boolean,
  period: Schema.Boolean,
  student: Schema.Boolean,
});

/**
 * The setup of a school (blueprint, Penyiapan sekolah): what its Owner or Admin has done so
 * far, read from the school's data, and the finish that takes the entry out of the sidebar.
 */
export default GroupSpec.make()
  .middleware(Session)
  .middleware(RequireMember)
  .addFunction(
    FunctionSpec.publicQuery({
      name: "state",
      args: () => ({ slug: TenantSlug }),
      returns: () => SetupState,
    }).middleware(TenantAccess, { action: "tenant.manage" })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "finish",
      args: () => ({ slug: TenantSlug }),
      returns: () => Schema.Null,
    }).middleware(TenantAccess, { action: "tenant.manage" })
  );
