import { type Duration, Effect, Fiber, Option, Ref } from "effect";

/** Work that waits until its input has been quiet, or runs at once when it is flushed. */
interface QuietSaver<A> {
  /** Runs the work now for the newest input, when one waits. */
  readonly flush: Effect.Effect<void>;
  /** Takes the newest input and starts the quiet period again. */
  readonly touch: (input: A) => Effect.Effect<void>;
}

/** The input that waits and the fiber that runs it once the quiet period has passed. */
interface Waiting<A> {
  readonly fiber: Fiber.Fiber<void>;
  readonly input: A;
}

/**
 * Makes a saver that runs `run` once `quietFor` has passed since the last input. A newer
 * input replaces the waiting one, so only the newest input runs, and it runs once. A
 * flush runs the waiting input at once, so a field that loses focus saves what it holds.
 * Each waiting fiber carries its own input, and the timer clears the waiting slot before
 * it runs, so a flush never runs an input that the timer already ran.
 */
export const makeQuietSaver = <A>(
  run: (input: A) => Effect.Effect<void>,
  quietFor: Duration.Input
) =>
  Effect.gen(function* () {
    const waiting = yield* Ref.make(Option.none<Waiting<A>>());

    const flush = Effect.gen(function* () {
      const current = yield* Ref.getAndSet(waiting, Option.none<Waiting<A>>());
      if (Option.isSome(current)) {
        yield* Fiber.interrupt(current.value.fiber);
        yield* run(current.value.input);
      }
    });

    const touch = (input: A) =>
      Effect.gen(function* () {
        const previous = yield* Ref.getAndSet(
          waiting,
          Option.none<Waiting<A>>()
        );
        if (Option.isSome(previous)) {
          yield* Fiber.interrupt(previous.value.fiber);
        }
        const fiber = yield* Effect.sleep(quietFor).pipe(
          Effect.andThen(Ref.set(waiting, Option.none<Waiting<A>>())),
          Effect.andThen(run(input)),
          Effect.forkDetach
        );
        yield* Ref.set(waiting, Option.some({ fiber, input }));
      });

    return { flush, touch } satisfies QuietSaver<A>;
  });
