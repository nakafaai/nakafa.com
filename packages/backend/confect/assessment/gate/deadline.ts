import {
  type Attempt,
  acceptsWrites,
} from "@repo/backend/confect/assessment/gate/store";
import { Clock, Effect } from "effect";

/** How late a deadline step may run before a sweep sends it again, so a step that is only slow is not doubled. */
export const DEADLINE_GRACE_MS = 60_000;

/**
 * Whether the step at an attempt's deadline has work when it runs: the attempt still accepts writes and its deadline
 * has passed. A step scheduled for a deadline that was moved later finds it not passed and leaves the attempt to the
 * step at the new deadline, and a step that runs twice finds the attempt ended, so every step is safe to send again.
 */
export const isDue = (
  attempt: Pick<Attempt, "deadline" | "state">,
  now: number
) => acceptsWrites(attempt.state) && now >= attempt.deadline;

/**
 * Sends again the step of every row whose deadline passed more than `DEADLINE_GRACE_MS` ago, one kind of row after
 * another. The scheduler runs a scheduled mutation once and never retries one that failed, so without a sweep a
 * missed step leaves an attempt open for good. Each kind reads one bounded page of its rows due by the time it is
 * given and asks the scheduler for each row's step, and the next sweep takes the rest. Every step reads its row
 * again before it acts (`isDue`), so a step sent twice changes nothing.
 */
export const sweepOverdue = Effect.fn("assessment.gate.deadline.sweep")(
  function* <R>(
    kinds: readonly ((upTo: number) => Effect.Effect<void, never, R>)[]
  ) {
    const upTo = (yield* Clock.currentTimeMillis) - DEADLINE_GRACE_MS;
    yield* Effect.forEach(kinds, (kind) => kind(upTo), { discard: true });
  }
);
