import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import { QueryRunner } from "@repo/backend/confect/_generated/services";
import { Duration, Effect, Exit, Schedule, Scope } from "effect";

/** How often a running generation asks whether its turn must stop. */
const HALT_POLL = Duration.seconds(1);

/**
 * Whether the turn was stopped, settled elsewhere or removed, so that its run
 * has no reason to go on. A read that fails counts as "not halted" and is
 * logged with the turn id and nothing else. The next check, a second later,
 * decides, so one failed read never ends the watch: a stop that the watch
 * missed would leave the provider call running after the page shows the turn as
 * stopped. The run asks the same question when its generation fails, and a read
 * that fails there never replaces the failure the run has to store.
 */
export const turnHalted = Effect.fn("nina.halt.halted")(function* (
  turnId: Docs["ninaTurns"]["_id"]
) {
  const { runQuery } = yield* QueryRunner;
  return yield* runQuery(refs.internal.nina.lifecycle.halted, { turnId }).pipe(
    Effect.orDie,
    Effect.catchDefect(() =>
      Effect.as(Effect.logWarning("Nina halt check failed", { turnId }), false)
    )
  );
});

/**
 * Watches the turn while its generation runs, and aborts the returned signal
 * once the learner stopped it or another path already settled it. That stops
 * the provider call even while it is silent, and lets Agent clean up before the
 * run exits and settles. The watch is a child of the run and ends with it. It
 * survives a failed check and asks again; the settlement that a stop schedules
 * and the sweep stay the backstop for a read that keeps failing.
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
