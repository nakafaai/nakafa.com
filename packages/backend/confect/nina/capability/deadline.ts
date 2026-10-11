import { type Deadline, purposes } from "@repo/backend/confect/gateway/purpose";
import { Clock, Context, Duration, Effect } from "effect";

/**
 * Time a chat step keeps for itself. A capability cannot see when its step
 * began, and Nina's own model call, which wrote the tool call, ran first in
 * that step, so a capability never plans past the end of the step less this
 * margin. It is a judgment, not a measurement.
 */
const STEP_MARGIN = Duration.seconds(20);

/**
 * How long before the run ends its own calls must end. A call that is cut at
 * its limit then fails while the capability can still report what it gathered,
 * instead of the run being cut together with it.
 */
const REPORT_MARGIN = Duration.seconds(2);

/** The longest one capability run may take: the chat step less its margin. */
export const CAPABILITY_BUDGET = Duration.subtract(
  Duration.millis(purposes.chat.timeout.stepMs),
  STEP_MARGIN
);

/** How long the calls inside a run may take in all. */
const CALL_BUDGET = Duration.subtract(CAPABILITY_BUDGET, REPORT_MARGIN);

/**
 * The time the running capability has left for its own model and provider
 * calls. The shared runner provides it, so a call cannot plan past the run. A
 * call outside a capability run has no run to respect and keeps only its own
 * limit, so the default is no limit at all.
 */
export const CapabilityDeadline = Context.Reference<{
  readonly left: Effect.Effect<Duration.Duration>;
}>("@repo/backend/confect/nina/capability/deadline/CapabilityDeadline", {
  defaultValue: () => ({ left: Effect.succeed(Duration.infinity) }),
});

/** How long the running capability has left for its own calls, never below zero. */
export const timeLeft = Effect.flatMap(CapabilityDeadline, ({ left }) => left);

/** `limit`, or the time left when that is shorter. */
export const limitDuration = Effect.fn("nina.capability.limitDuration")(
  function* (limit: Duration.Duration) {
    return Duration.min(limit, yield* timeLeft);
  }
);

/** An AI SDK deadline whose step and total limits are cut to the time left. */
export const limitDeadline = Effect.fn("nina.capability.limitDeadline")(
  function* (deadline: Deadline) {
    const left = Duration.toMillis(yield* timeLeft);
    return {
      ...deadline,
      stepMs: Math.min(deadline.stepMs, left),
      totalMs: Math.min(deadline.totalMs, left),
    };
  }
);

/**
 * Runs a capability under its deadline. Its own calls see the time left
 * through `CapabilityDeadline`, which ends `REPORT_MARGIN` before the run does.
 * A run still going at `CAPABILITY_BUDGET` is interrupted, which aborts the
 * model calls it has in flight, and `timedOut` takes its place.
 */
export const boundCapability = Effect.fn("nina.capability.bound")(function* <
  A,
  E,
  R,
  B,
  E2,
  R2,
>(run: Effect.Effect<A, E, R>, timedOut: Effect.Effect<B, E2, R2>) {
  const endsAt =
    (yield* Clock.currentTimeMillis) + Duration.toMillis(CALL_BUDGET);
  const left = Effect.map(Clock.currentTimeMillis, (now) =>
    Duration.max(Duration.zero, Duration.millis(endsAt - now))
  );
  return yield* run.pipe(
    Effect.provideService(CapabilityDeadline, { left }),
    Effect.timeoutOrElse({
      duration: CAPABILITY_BUDGET,
      orElse: () => timedOut,
    })
  );
});
