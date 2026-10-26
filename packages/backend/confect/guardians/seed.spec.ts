import { FunctionSpec, GroupSpec } from "@confect/core";
import { SeedRefused } from "@repo/backend/confect/acceptance/seed";
import { Nisn } from "@repo/backend/confect/roster/schema";
import { Email } from "@repo/backend/confect/tenancy/schema";
import { Schema } from "effect";

/**
 * The acceptance seed of a parent's sign-in. It is internal, so no browser can call it, and
 * only the acceptance command line calls it with the deployment's key (ADR 0034).
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "code",
    args: () => ({ email: Email, nisn: Nisn, slug: Schema.String }),
    returns: () => Schema.Struct({ code: Schema.String }),
    error: () => SeedRefused,
  })
);
