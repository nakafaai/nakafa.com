import { refusal } from "@repo/backend/confect/tenancy/errors";
import { Config, Effect, Schema } from "effect";

/**
 * A seed that the deployment refuses, because it is not the acceptance runtime. A seed writes
 * test rows, so no deployment outside acceptance may run one.
 */
export class SeedRefused extends Schema.TaggedError<SeedRefused>()(
  "SeedRefused",
  refusal("SEED_REFUSED", "Seeds run only in the acceptance runtime.")
) {}

/** A seed that needs an active unit of its school, and the school has none. */
export class SeedUnitMissing extends Schema.TaggedError<SeedUnitMissing>()(
  "SeedUnitMissing",
  refusal("SEED_UNIT_MISSING", "The school has no active unit to seed into.")
) {}

/**
 * Refuses the seed unless the Convex environment sets `ACCEPTANCE_SEED` to true. The acceptance
 * runtime writes that value into its deployment, and production and development never set it,
 * so an absent flag refuses too.
 */
export const requireAcceptanceSeed = Effect.fn("acceptance.seed.require")(
  function* () {
    const enabled = yield* Config.Boolean("ACCEPTANCE_SEED").pipe(
      Config.withDefault(false),
      Effect.orDie
    );
    if (!enabled) {
      return yield* new SeedRefused();
    }
  }
);
