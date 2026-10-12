import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import { QueryRunner } from "@repo/backend/confect/_generated/services";
import { Duration, Effect, Exit, Schedule, Scope } from "effect";

/** How often a running generation asks whether its turn must stop. */
const HALT_POLL = Duration.seconds(1);

/**
 * Whether the turn was stopped, settled elsewhere or removed, so that its run
 * has no reason to go on.
 */
export const turnHalted = Effect.fn("nina.halt.halted")(function* (
  turnId: Docs["ninaTurns"]["_id"]
) {
  const { runQuery } = yield* QueryRunner;
  return yield* runQuery(refs.internal.nina.lifecycle.halted, { turnId }).pipe(
    Effect.orDie
  );
});

/**
 * Watches the turn while its generation runs, and aborts the returned signal
 * once the learner stopped it or another path already settled it. That stops
 * the provider call even while it is silent, and lets Agent clean up before the
 * run exits and settles. The watch is a child of the run and ends with it; a
 * failed check leaves the generation running, and the settlement that a stop
 * schedules and the sweep stay the backstop.
 */
export const watchHalt = Effect.fn("nina.halt.watch")(function* (
  turnId: Docs["ninaTurns"]["_id"]
) {
  const haltScope = yield* Scope.make();
  const halt = yield* Effect.abortSignal.pipe(Scope.provide(haltScope));
  yield* turnHalted(turnId).pipe(
    Effect.repeat({
      schedule: Schedule.spaced(HALT_POLL),
      until: (halted) => halted,
    }),
    Effect.andThen(Scope.close(haltScope, Exit.void)),
    Effect.forkChild
  );
  return halt;
});
