import { ConvexError } from "convex/values";
import { Cause, Clock, Effect, Exit, Option } from "effect";

/** The stable error shape every Convex-facing Effect failure must provide. */
export interface ConvexTaggedError {
  readonly _tag: string;
  readonly code: string;
  readonly message: string;
}

const nanosPerMillisecond = 1_000_000n;

const convexClock: Clock.Clock = {
  [Clock.ClockTypeId]: Clock.ClockTypeId,
  currentTimeMillis: Effect.sync(() => Date.now()),
  currentTimeNanos: Effect.sync(() => BigInt(Date.now()) * nanosPerMillisecond),
  sleep: () =>
    Effect.die(
      new Error("Effect.sleep is not supported inside native Convex handlers.")
    ),
  unsafeCurrentTimeMillis: () => Date.now(),
  unsafeCurrentTimeNanos: () => BigInt(Date.now()) * nanosPerMillisecond,
};

/**
 * Runs one local Effect program at a native Convex handler seam.
 *
 * Convex mutations/queries reject the Performance API, while Effect's default
 * clock can use it for tracing. This boundary installs a Date-backed clock
 * locally for each program without creating a global runtime or layer.
 *
 * References:
 * - Effect running guide: https://effect.website/docs/getting-started/running-effects/
 * - Convex error handling: https://docs.convex.dev/functions/error-handling/
 * - Convex action runtime note: https://docs.convex.dev/functions/actions
 */
export async function runConvexProgram<A, E extends ConvexTaggedError>(
  program: Effect.Effect<A, E, never>
) {
  const exit = await Effect.runPromiseExit(
    Effect.withClock(program, convexClock)
  );

  return Exit.match(exit, {
    onFailure: (cause) => {
      const failure = Cause.failureOption(cause);

      if (Option.isSome(failure)) {
        throw new ConvexError({
          code: failure.value.code,
          message: failure.value.message,
        });
      }

      throw Cause.squash(cause);
    },
    onSuccess: (value) => value,
  });
}

/** Converts an unknown thrown value into a stable message for tagged errors. */
export function getUnknownErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
