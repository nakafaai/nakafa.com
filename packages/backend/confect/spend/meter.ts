import spendInternal from "@repo/backend/confect/_generated/refs/spend.server";
import { MutationRunner } from "@repo/backend/confect/_generated/services";
import type { Work } from "@repo/backend/confect/spend/rates";
import type {
  Claim,
  Escrow,
  SpendRefused,
} from "@repo/backend/confect/spend/schema";
import { Context, Effect, Exit, Layer } from "effect";

/**
 * The escrow of one action's calls, for the claim the action works for. Every
 * model call and every web call holds up to its ceiling before it runs and
 * settles to what it cost after it, as `holdSpend` bounds it.
 */
export class Meter extends Context.Service<
  Meter,
  {
    readonly hold: (
      work: Work,
      ceiling: number
    ) => Effect.Effect<Escrow, SpendRefused>;
    readonly settle: (escrow: Escrow, spent: number) => Effect.Effect<void>;
  }
>()("@repo/backend/confect/spend/meter") {}

/** The meter of an action that works for `claim`, over the escrow mutations. */
export const meterOf = (claim: Claim) =>
  Layer.effect(
    Meter,
    Effect.map(MutationRunner, ({ runMutation }) =>
      Meter.of({
        hold: (work, ceiling) =>
          runMutation(spendInternal.escrow.hold, { ceiling, claim, work }).pipe(
            Effect.catchTag("SchemaError", Effect.die)
          ),
        settle: (escrow, spent) =>
          runMutation(spendInternal.escrow.settle, {
            escrowId: escrow.escrowId,
            spent,
          }).pipe(Effect.orDie, Effect.asVoid),
      })
    )
  );

/**
 * Runs `call` inside an escrow of up to `ceiling` micro-dollars. A call that
 * succeeds settles to `cost` of its result. A call that fails or is
 * interrupted settles to the whole ceiling, because the vendor may have billed
 * it and nothing says how much, so a retry never spends the same budget twice.
 */
export const metered = Effect.fn("spend.metered")(function* <A, E, R>(
  work: Work,
  ceiling: number,
  call: Effect.Effect<A, E, R>,
  cost: (result: A) => number
) {
  const meter = yield* Meter;
  return yield* Effect.acquireUseRelease(
    meter.hold(work, ceiling),
    () => call,
    (escrow, exit) =>
      meter.settle(escrow, Exit.isSuccess(exit) ? cost(exit.value) : ceiling)
  );
});
