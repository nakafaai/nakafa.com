import { FunctionSpec, GroupSpec } from "@confect/core";
import { SeedRefused } from "@repo/backend/confect/acceptance/seed";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/**
 * The acceptance seed of a school's connection. It is internal, so no browser can call it, and
 * only the acceptance command line calls it with the deployment's key.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "connection",
    args: () => ({
      slug: TenantSlug,
      status: Schema.Literals(["active", "reconnect"]),
    }),
    returns: () => Schema.Null,
    error: () => SeedRefused,
  })
);
