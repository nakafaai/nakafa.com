import { purposes } from "@repo/backend/confect/gateway/purpose";
import { Duration } from "effect";

/**
 * How long a queued turn may wait for its run to start. A run that starts
 * later could still be in its chat call when the turn's deadline passes, so
 * the claim refuses it instead.
 */
export const START_DEADLINE = Duration.seconds(30);

/**
 * How long a turn may stay open, counted from its admission: the wait for its
 * run to start, the chat call's total budget, and half a minute for the last
 * save and the settlement. A turn past it can no longer finish on its own. The
 * sweep, the open-turn limit and the release gate all measure a turn by it.
 */
export const TURN_DEADLINE = Duration.sum(
  Duration.sum(START_DEADLINE, Duration.millis(purposes.chat.timeout.totalMs)),
  Duration.seconds(30)
);
