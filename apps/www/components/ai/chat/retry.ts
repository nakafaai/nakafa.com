import { Effect, Exit, Fiber, MutableRef, Option } from "effect";

/**
 * Starts the wait for a share link's answer, and holds the one wait that is
 * open. A wait ends when the server answers, when it fails, or when it is
 * interrupted. Each wait is forked detached, so the caller that started it can
 * finish while the wait goes on. A new retry or a dispose interrupts the open
 * wait first, and the `ended` callback of that wait runs before the new work
 * starts.
 *
 * The controller runs nothing. Its functions return effects, and the caller
 * decides where they run.
 */
export function makeAnswerRetry() {
  const openWait = MutableRef.make<Option.Option<Fiber.Fiber<void, unknown>>>(
    Option.none()
  );

  /** Interrupts the open wait, if there is one, and returns once it has ended. */
  const interruptOpenWait = Effect.suspend(() => {
    const wait = MutableRef.get(openWait);
    return Option.isSome(wait) ? Fiber.interrupt(wait.value) : Effect.void;
  });

  return {
    /**
     * Ends the open wait, then starts `wait` detached from the caller. The wait
     * calls `on.answered` when it succeeds, and `on.ended` when it fails or is
     * interrupted. Either way the wait is no longer open afterwards.
     */
    retry: Effect.fn("chat.share.retry")(function* <E>(
      wait: Effect.Effect<void, E>,
      on: { answered: () => void; ended: () => void }
    ) {
      yield* interruptOpenWait;
      const fiber = yield* wait.pipe(
        Effect.onExit((exit) =>
          Effect.sync(() => {
            MutableRef.set(openWait, Option.none());
            if (Exit.isSuccess(exit)) {
              on.answered();
            } else {
              on.ended();
            }
          })
        ),
        // The wait starts at once. A fiber that is interrupted before its first
        // step never reaches `onExit`, so its `ended` callback would not run.
        Effect.forkDetach({ startImmediately: true })
      );
      MutableRef.set(openWait, Option.some(fiber));
    }),
    /** Ends the open wait, if there is one, and does nothing otherwise. */
    dispose: Effect.fn("chat.share.dispose")(function* () {
      yield* interruptOpenWait;
    }),
  };
}
