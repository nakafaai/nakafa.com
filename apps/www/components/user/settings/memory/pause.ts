import { Effect } from "effect";

/**
 * Gives the learner's pause choice back when the server refuses the change, so
 * the switch shows what the page read again. The choice already moved when the
 * learner pressed the switch. `change` is the change on its way, and it fails
 * with the error of the refusal. `refused` tells the learner about that error
 * first, as it does for every change that fails.
 */
export const revertRefusedPause = Effect.fn("www.memory.revertRefusedPause")(
  function* <A, E, B>(
    setPaused: (paused: boolean | null) => void,
    change: Effect.Effect<A, E>,
    refused: (error: E) => Effect.Effect<B>
  ) {
    yield* Effect.matchEffect(change, {
      onFailure: (error) =>
        Effect.andThen(
          refused(error),
          Effect.sync(() => setPaused(null))
        ),
      onSuccess: () => Effect.void,
    });
  }
);
