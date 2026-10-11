import { CapabilityDeadline } from "@repo/backend/confect/nina/capability/deadline";
import { Duration, Effect } from "effect";

/**
 * Runs an effect as a capability that has `left` for its own calls, whatever
 * the clock says, so a test sets the time a call may use without a run.
 */
export const withTimeLeft = (left: Duration.Input) =>
  Effect.provideService(CapabilityDeadline, {
    left: Effect.succeed(Duration.fromInputUnsafe(left)),
  });
