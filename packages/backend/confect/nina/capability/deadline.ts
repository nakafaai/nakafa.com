import { type Deadline, purposes } from "@repo/backend/confect/gateway/purpose";
import { Clock, Context, Duration, Effect, Ref } from "effect";

/**
 * Time a chat step keeps for itself after a capability ends. The tool result
 * reaches the model and the step is saved inside the step's own timer, so a run
 * that used all of the step would be cut by the step. It is a judgment, not a
 * measurement.
 */
const STEP_MARGIN = Duration.seconds(10);

/**
 * How long before the run ends its own calls must end. A call that is cut at
 * its limit then fails while the capability can still report what it gathered,
 * instead of the run being cut together with it.
 */
const REPORT_MARGIN = Duration.seconds(2);

/** The longest one capability run may take: a whole chat step less its margin. */
export const CAPABILITY_BUDGET = Duration.subtract(
  Duration.millis(purposes.chat.timeout.stepMs),
  STEP_MARGIN
);

/**
 * The chat step that holds the running capability. The step's timer started
 * with the step, and Nina's own model call, which wrote the tool call, has run
 * inside it since, so a capability counts its time from the start of its step
 * and not from its own. `startedAt` is that start, in clock milliseconds.
 */
export class ChatStep extends Context.Service<
  ChatStep,
  { readonly startedAt: Effect.Effect<number> }
>()("@repo/backend/confect/nina/capability/deadline/ChatStep") {}

/**
 * Follows the chat steps of one turn. The AI SDK starts a step's timer and then
 * calls `prepareStep`, so `begin` there marks the step that the tools called in
 * it belong to. The first step is marked when the turn starts, and each later
 * step replaces the mark.
 */
export const makeChatStep = Effect.fn("nina.capability.chatStep")(function* () {
  const began = yield* Ref.make(yield* Clock.currentTimeMillis);
  return {
    begin: Effect.flatMap(Clock.currentTimeMillis, (now) =>
      Ref.set(began, now)
    ),
    startedAt: Ref.get(began),
  };
});

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
 * Runs a capability under its deadline: the end of its chat step less
 * `STEP_MARGIN`, counted from the start of that step. Its own calls see the time
 * left through `CapabilityDeadline`, which ends `REPORT_MARGIN` before the run
 * does. A run still going at its deadline is interrupted, which aborts the model
 * calls it has in flight, and `timedOut` takes its place. A run whose step has
 * no time left never starts.
 */
export const boundCapability = Effect.fn("nina.capability.bound")(function* <
  A,
  E,
  R,
  B,
  E2,
  R2,
>(run: Effect.Effect<A, E, R>, timedOut: Effect.Effect<B, E2, R2>) {
  const step = yield* ChatStep;
  const endsAt = (yield* step.startedAt) + Duration.toMillis(CAPABILITY_BUDGET);
  const now = yield* Clock.currentTimeMillis;
  if (now >= endsAt) {
    return yield* timedOut;
  }
  const callsEndAt = endsAt - Duration.toMillis(REPORT_MARGIN);
  const left = Effect.map(Clock.currentTimeMillis, (at) =>
    Duration.max(Duration.zero, Duration.millis(callsEndAt - at))
  );
  return yield* run.pipe(
    Effect.provideService(CapabilityDeadline, { left }),
    Effect.timeoutOrElse({
      duration: Duration.millis(endsAt - now),
      orElse: () => timedOut,
    })
  );
});
