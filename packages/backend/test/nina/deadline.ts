import {
  CapabilityDeadline,
  ChatStep,
} from "@repo/backend/confect/nina/capability/deadline";
import { Clock, Deferred, Duration, Effect } from "effect";

/**
 * Runs an effect as a capability that has `left` for its own calls, whatever
 * the clock says, so a test sets the time a call may use without a run.
 */
export const withTimeLeft = (left: Duration.Input) =>
  Effect.provideService(CapabilityDeadline, {
    left: Effect.succeed(Duration.fromInputUnsafe(left)),
  });

/**
 * A model call that never answers: `answer` ends only when the SDK aborts its
 * signal, and `begun` settles once the call has started, so a test moves its
 * fake clock only when the call is waiting.
 */
export function neverAnswering() {
  const begun = Deferred.makeUnsafe<void>();
  return {
    answer: (signal: AbortSignal | undefined) => {
      Deferred.doneUnsafe(begun, Effect.void);
      return Effect.runPromise(Effect.never, { signal });
    },
    begun: Effect.runPromise(Deferred.await(begun)),
  };
}

/**
 * Runs an effect inside a chat step that begins the moment the effect reads it,
 * in a turn that begins now, so a capability in it has its whole step.
 */
export const inNewChatStep = Effect.provideServiceEffect(
  ChatStep,
  Effect.map(Clock.currentTimeMillis, (turnStartedAt) => ({
    startedAt: Clock.currentTimeMillis,
    turnStartedAt,
  }))
);
