import { ConvexError } from "convex/values";
import { Cause, Clock, Effect, Exit, Option, Result, Scheduler } from "effect";

/** The stable error shape every Convex-facing Effect failure must provide. */
export interface ConvexTaggedError {
  readonly _tag: string;
  readonly code: string;
  readonly message: string;
}

/** Reads the stable code and message from one typed Convex error payload. */
export function readConvexErrorData(error: unknown) {
  if (!(error instanceof ConvexError)) {
    return null;
  }

  const data = error.data;
  if (typeof data !== "object" || data === null) {
    return null;
  }

  const code = "code" in data ? data.code : undefined;
  const message = "message" in data ? data.message : undefined;
  if (typeof code !== "string" || typeof message !== "string") {
    return null;
  }

  return { code, message };
}

const nanosPerMillisecond = 1_000_000n;

const convexClock: Clock.Clock = {
  currentTimeMillis: Effect.sync(() => Date.now()),
  currentTimeMillisUnsafe: () => Date.now(),
  currentTimeNanos: Effect.sync(() => BigInt(Date.now()) * nanosPerMillisecond),
  currentTimeNanosUnsafe: () => BigInt(Date.now()) * nanosPerMillisecond,
  monotonicTimeNanos: Effect.sync(
    () => BigInt(Date.now()) * nanosPerMillisecond
  ),
  monotonicTimeNanosUnsafe: () => BigInt(Date.now()) * nanosPerMillisecond,
  sleep: () =>
    Effect.die(
      new Error("Effect.sleep is not supported inside native Convex handlers.")
    ),
};

/** Dispatches Effect fiber yields without forbidden native Convex timers. */
function scheduleNativeConvexMicrotask(task: () => void) {
  let cancelled = false;

  Promise.resolve().then(() => {
    if (!cancelled) {
      task();
    }
  });

  return () => {
    cancelled = true;
  };
}

const nativeConvexScheduler = new Scheduler.MixedScheduler(
  "async",
  scheduleNativeConvexMicrotask
);

/** Resolves one Effect exit into the stable Convex boundary behavior. */
function resolveConvexExit<A, E extends ConvexTaggedError>(
  exit: Exit.Exit<A, E>
) {
  return Exit.match(exit, {
    onFailure: (cause) => {
      const defect = Cause.findDefect(cause);

      if (Result.isSuccess(defect)) {
        throw defect.success;
      }

      const failure = Cause.findErrorOption(cause);

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

/**
 * Runs one local Effect program at a native Convex handler seam.
 *
 * Convex mutations/queries reject the Performance API, while Effect's default
 * clock can use it for tracing. This boundary installs a Date-backed clock
 * locally for each program without creating a global runtime or layer.
 * The native runtime also omits setImmediate and rejects setTimeout. Effect's
 * async scheduler falls back to those timers for cooperative fiber yields, so
 * this boundary preserves async execution with cancellable microtask dispatch.
 *
 * References:
 * - Effect running guide: https://effect.website/docs/getting-started/running-effects/
 * - Effect Convex scheduler issue: https://github.com/Effect-TS/effect/issues/6651
 * - Convex error handling: https://docs.convex.dev/functions/error-handling/
 * - Convex action runtime note: https://docs.convex.dev/functions/actions
 * - Convex deterministic runtime: https://docs.convex.dev/functions/runtimes
 */
export async function runConvexProgram<A, E extends ConvexTaggedError>(
  program: Effect.Effect<A, E, never>
) {
  const exit = await Effect.runPromiseExit(
    program.pipe(Effect.provideService(Clock.Clock, convexClock)),
    { scheduler: nativeConvexScheduler }
  );

  return resolveConvexExit(exit);
}

/**
 * Runs one Effect program at the Node Convex action boundary.
 *
 * Node actions support Effect's live clock, including bounded sleeps used to
 * observe durable scheduled mutations. Native queries and mutations continue
 * to use the Date-backed boundary above.
 */
export async function runConvexActionProgram<A, E extends ConvexTaggedError>(
  program: Effect.Effect<A, E, never>
) {
  const exit = await Effect.runPromiseExit(program);
  return resolveConvexExit(exit);
}

/** Converts an unknown thrown value into a stable message for tagged errors. */
export function getUnknownErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
