import spendInternal from "@repo/backend/confect/_generated/refs/spend.server";
import { MutationRunner } from "@repo/backend/confect/_generated/services";
import type { Work } from "@repo/backend/confect/spend/rates";
import type {
  Claim,
  Escrow,
  SpendRefused,
} from "@repo/backend/confect/spend/schema";
import { Context, Effect, Exit, Layer, Semaphore } from "effect";

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

/**
 * The meter of an action that works for `claim`, over the escrow mutations.
 * Every hold and settle of one payer reads all of its month's rows and writes
 * one, so two of them at once retry against each other. One action's calls
 * often run at once, such as the four embedding requests of a lesson build, so
 * the meter writes one escrow at a time: on 15 Nov 2026 a release's re-embed
 * retried 1,194 holds and 390 settles on the Nakafa row, and one hold failed
 * after four retries. The calls themselves still run at once; only their
 * escrow writes, a few milliseconds each, wait their turn.
 */
export const meterOf = (claim: Claim) =>
  Layer.effect(
    Meter,
    Effect.gen(function* () {
      const { runMutation } = yield* MutationRunner;
      const turn = yield* Semaphore.make(1);
      return Meter.of({
        hold: (work, ceiling) =>
          runMutation(spendInternal.escrow.hold, { ceiling, claim, work }).pipe(
            Effect.catchTag("SchemaError", Effect.die),
            turn.withPermit
          ),
        settle: (escrow, spent) =>
          runMutation(spendInternal.escrow.settle, {
            escrowId: escrow.escrowId,
            spent,
          }).pipe(Effect.orDie, Effect.asVoid, turn.withPermit),
      });
    })
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
