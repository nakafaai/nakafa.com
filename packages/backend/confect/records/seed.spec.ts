import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { SeedRefused } from "@repo/backend/confect/acceptance/seed";
import { Email } from "@repo/backend/confect/tenancy/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

/** What the graduation seed answers: the graduating class group and its name. */
const GraduationSeed = Schema.Struct({
  cohort: Schema.String,
  cohortId: Id("tenantCohorts"),
});

/**
 * The acceptance seed of a graduation (ADR 0033, S6). It is internal, so no browser can call it,
 * and only the acceptance command line calls it with the deployment's key.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "graduation",
    args: () => ({ email: Email, slug: TenantSlug }),
    returns: () => GraduationSeed,
    error: () => SeedRefused,
  })
);
