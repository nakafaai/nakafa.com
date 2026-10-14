import { DateTime, Duration, Option, Schema } from "effect";

/**
 * The least time between two snapshots of one document. ADR 0028 Bounds allows
 * at most one snapshot every 30 seconds, so a busy editor cannot write a
 * snapshot for each change it receives.
 */
export const SNAPSHOT_MIN_GAP = Duration.seconds(30);

/**
 * How long the editor must stay idle before a snapshot is due. ADR 0028 Bounds
 * writes a snapshot while the editor is idle, so the snapshot lands once the
 * typing stops.
 */
export const SNAPSHOT_IDLE_DELAY = Duration.seconds(30);

/**
 * The steps since the last snapshot that make a snapshot due while the editor
 * is busy. Without this count, an editor that never pauses would write no
 * snapshot, and its step log would keep growing.
 */
export const SNAPSHOT_STEP_LIMIT = 300;

/** What the snapshot rule reads: the last snapshot, the last step, the steps since it, and the time now. */
const SnapshotStateSchema = Schema.Struct({
  lastSnapshotAt: Schema.Option(Schema.DateTimeUtc),
  lastStepAt: Schema.DateTimeUtc,
  now: Schema.DateTimeUtc,
  stepsSince: Schema.Natural,
});
export type SnapshotState = typeof SnapshotStateSchema.Type;

/** The milliseconds from one time to a later one; negative when the later time is earlier. */
function millisBetween(from: DateTime.Utc, to: DateTime.Utc): number {
  return Duration.toMillis(DateTime.distance(from, to));
}

/**
 * Whether a snapshot is due now. Nothing is due without a step since the last
 * snapshot. Otherwise the minimum gap must have passed since the last snapshot,
 * and then a snapshot is due once the editor has been idle for the idle delay or
 * once `SNAPSHOT_STEP_LIMIT` steps have gathered. A snapshot that falls due while
 * the gap is still open waits for a later check.
 */
export function snapshotDue(state: SnapshotState): boolean {
  if (state.stepsSince === 0) {
    return false;
  }
  const gapPassed = Option.match(state.lastSnapshotAt, {
    onNone: () => true,
    onSome: (at) =>
      millisBetween(at, state.now) >= Duration.toMillis(SNAPSHOT_MIN_GAP),
  });
  if (!gapPassed) {
    return false;
  }
  const idle =
    millisBetween(state.lastStepAt, state.now) >=
    Duration.toMillis(SNAPSHOT_IDLE_DELAY);
  return idle || state.stepsSince >= SNAPSHOT_STEP_LIMIT;
}
