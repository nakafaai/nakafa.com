import { ConvexConfigProvider } from "@confect/server";
import type { ConvexTaggedError } from "@repo/backend/confect/failure";
import { ConvexError } from "convex/values";
import { Cause, Clock, Effect, Exit, Option, Result, Scheduler } from "effect";

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
 * Runs an Effect at a trigger, authentication, workflow or HTTP SDK callback.
 * Registered Confect functions use their own native runner.
 *
 * Convex mutations/queries reject the Performance API, while Effect's default
 * clock can use it for tracing. This boundary installs a Date-backed clock
 * locally for each program without creating a global runtime or layer.
 * Span timing is disabled so named programs do not implicitly depend on
 * Date.now(), which shortens Convex query cache lifetimes. Span names and
 * explicit domain clock reads remain available.
 * The native runtime also omits setImmediate and rejects setTimeout. Effect's
 * async scheduler falls back to those timers for cooperative fiber yields, so
 * this boundary preserves async execution with cancellable microtask dispatch.
 * Native Convex rejects import.meta and exposes process.env through a get-only
 * proxy. Confect owns named environment lookups at this SDK boundary.
 *
 * References:
 * - Effect running guide: https://effect.website/docs/getting-started/running-effects/
 * - Effect Convex scheduler issue: https://github.com/Effect-TS/effect/issues/6651
 * - Convex error handling: https://docs.convex.dev/functions/error-handling/
 * - Convex action runtime note: https://docs.convex.dev/functions/actions
 * - Convex deterministic runtime: https://docs.convex.dev/functions/runtimes
 * - Convex query clock: https://docs.convex.dev/understanding/best-practices#dont-use-datenow-in-queries
 * - Convex environment proxy: https://github.com/get-convex/convex-backend/blob/main/npm-packages/udf-runtime/src/setup.ts
 */
export async function runConvexProgram<A, E extends ConvexTaggedError>(
  program: Effect.Effect<A, E, never>
) {
  const exit = await Effect.runPromiseExit(
    program.pipe(
      Effect.withTracerTiming(false),
      Effect.provideService(Clock.Clock, convexClock),
      Effect.provide(ConvexConfigProvider.layer)
    ),
    {
      scheduler: nativeConvexScheduler,
    }
  );
  return resolveConvexExit(exit);
}
