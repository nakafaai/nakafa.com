import { FunctionSpec, GroupSpec } from "@confect/core";
import { TenantNotFound } from "@repo/backend/confect/tenancy/errors";
import { TenantProfile } from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";

export default GroupSpec.make().addFunction(
  FunctionSpec.publicQuery({
    name: "get",
    args: () => ({ slug: TenantSlug }),
    returns: () => TenantProfile,
    error: () => TenantNotFound,
  })
);
