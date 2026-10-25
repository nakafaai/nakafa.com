import { FunctionSpec, GroupSpec } from "@confect/core";
import { SeedRefused } from "@repo/backend/confect/acceptance/seed";
import { LoginName } from "@repo/backend/confect/identity/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** What the acceptance seed answers: the school login name of the new card, and its plain code. */
const CardSeed = Schema.Struct({
  code: Schema.String,
  loginName: LoginName,
});

/**
 * The acceptance seed of login cards. It is internal, so no browser can call it, and only the
 * acceptance command line calls it with the deployment's key (ADR 0009).
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "card",
    args: () => ({ slug: TenantSlug }),
    returns: () => CardSeed,
    error: () => SeedRefused,
  })
);
