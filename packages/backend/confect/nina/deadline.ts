import { purposes } from "@repo/backend/confect/gateway/purpose";
import { Duration } from "effect";

/**
 * How long a queued turn may wait for its run to start. A run that starts
 * later could still be in its chat call when the turn's deadline passes, so
 * the claim refuses it instead. Admission also schedules one check for this
 * moment, which settles a turn whose run never started.
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

/** How often the sweep looks for turns that stayed open past their deadline. */
export const SWEEP_INTERVAL = Duration.minutes(5);

/** How many times the sweep tries to settle a turn before it gives up on the turn's journal. */
const SETTLE_TRIES = 3;

/**
 * How long after the sweep first finds a turn past its deadline it ends the
 * turn without the Agent journal, if the turn is still open. By then the sweep
 * has tried to settle it `SETTLE_TRIES` times, once per run. A settlement that
 * fails every time would otherwise keep the chat busy and the credits held for
 * good.
 */
export const SETTLE_GRACE = Duration.times(SWEEP_INTERVAL, SETTLE_TRIES);
