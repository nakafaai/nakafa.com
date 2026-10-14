import { describe, expect, it } from "@effect/vitest";
import {
  SNAPSHOT_IDLE_DELAY,
  SNAPSHOT_MIN_GAP,
  SNAPSHOT_STEP_LIMIT,
  type SnapshotState,
  snapshotDue,
} from "@repo/backend/confect/editor/snapshot";
import { DateTime, Duration, Option, Schema } from "effect";

/** The time now, in epoch milliseconds. */
const NOW = 10_000_000;
const GAP = Duration.toMillis(SNAPSHOT_MIN_GAP);
const IDLE = Duration.toMillis(SNAPSHOT_IDLE_DELAY);

/** One editor's timing. Each time is how many milliseconds before now it happened. */
const TimingSchema = Schema.Struct({
  snapshotAgo: Schema.optionalKey(Schema.Finite),
  stepAgo: Schema.Finite,
  steps: Schema.Finite,
});
type Timing = typeof TimingSchema.Type;

/** The snapshot rule's state for one timing; a timing without `snapshotAgo` has no snapshot yet. */
function stateOf(timing: Timing): SnapshotState {
  return {
    lastSnapshotAt:
      timing.snapshotAgo === undefined
        ? Option.none()
        : Option.some(DateTime.makeUnsafe(NOW - timing.snapshotAgo)),
    lastStepAt: DateTime.makeUnsafe(NOW - timing.stepAgo),
    now: DateTime.makeUnsafe(NOW),
    stepsSince: timing.steps,
  };
}

const cases = [
  {
    due: false,
    name: "nothing is due without a step since the last snapshot",
    timing: { snapshotAgo: GAP * 10, stepAgo: IDLE * 10, steps: 0 },
  },
  {
    due: true,
    name: "a first snapshot is due once the editor has been idle for the delay",
    timing: { stepAgo: IDLE, steps: 1 },
  },
  {
    due: false,
    name: "a first snapshot waits while the editor is still typing",
    timing: { stepAgo: IDLE - 1, steps: 1 },
  },
  {
    due: false,
    name: "a snapshot waits for the minimum gap, even at the step limit",
    timing: { snapshotAgo: GAP - 1, stepAgo: 0, steps: SNAPSHOT_STEP_LIMIT },
  },
  {
    due: true,
    name: "a busy editor is snapshotted at the step limit once the gap has passed",
    timing: { snapshotAgo: GAP, stepAgo: 0, steps: SNAPSHOT_STEP_LIMIT },
  },
  {
    due: false,
    name: "a busy editor waits below the step limit",
    timing: { snapshotAgo: GAP, stepAgo: 0, steps: SNAPSHOT_STEP_LIMIT - 1 },
  },
  {
    due: true,
    name: "an idle editor is snapshotted once the idle delay has passed",
    timing: { snapshotAgo: GAP, stepAgo: IDLE, steps: 1 },
  },
  {
    due: false,
    name: "an idle editor waits while the idle delay is still open",
    timing: { snapshotAgo: GAP, stepAgo: IDLE - 1, steps: 1 },
  },
  {
    due: false,
    name: "a last snapshot dated after now keeps the gap closed",
    timing: { snapshotAgo: -GAP, stepAgo: IDLE, steps: 1 },
  },
  {
    due: false,
    name: "a last step dated after now is not idle",
    timing: { snapshotAgo: GAP, stepAgo: -1, steps: 1 },
  },
];

describe("editor/snapshot rule", () => {
  it.each(cases)("$name", ({ due, timing }) => {
    expect(snapshotDue(stateOf(timing))).toBe(due);
  });
});
