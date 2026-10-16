import { Duration } from "effect";

/**
 * How long a step that a snapshot covers stays in the log, after its creation. A
 * client that was offline for less than this loads the steps it missed; a client
 * offline for longer opens again from the snapshot (ADR 0028 Bounds). Ten minutes
 * is the value the build sets, and the ADR records it.
 */
export const STEP_KEEP_DELAY = Duration.minutes(10);

/**
 * How often the sweep starts. It runs at the pace of the keep delay, so a covered
 * step waits at most one interval after the delay before it is deleted.
 */
export const PRUNE_INTERVAL = Duration.minutes(10);

/**
 * How many steps one page of the sweep reads. A step is at most one batch of
 * `MAX_BATCH_BYTES`, so 64 steps read at most 8 MiB, under the 16 MiB that a
 * transaction may read (ADR 0028 Context).
 */
export const PRUNE_PAGE_STEPS = 64;

/**
 * Whether the sweep deletes a step: a snapshot at `snapshotVersion` covers it, and
 * it is at least `STEP_KEEP_DELAY` old at `now`. Both times are epoch milliseconds.
 */
export function isPrunable(input: {
  createdAt: number;
  now: number;
  snapshotVersion: number;
  version: number;
}): boolean {
  return (
    input.version <= input.snapshotVersion &&
    input.now - input.createdAt >= Duration.toMillis(STEP_KEEP_DELAY)
  );
}
