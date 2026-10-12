import type { NinaTurnsDoc } from "@repo/backend/confect/_generated/docs";
import { NinaTurnTiming } from "@repo/backend/confect/nina/contract/turn";
import { Array as Arr, Number as Num, Order, Struct } from "effect";

/** A stage a turn can store a wait for. */
type Stage = keyof typeof NinaTurnTiming.Type;

/**
 * The nearest-rank percentile of `values`: sort them, then take the value at
 * rank `ceil(percent / 100 * count)`, counting from 1 and kept inside the list.
 * So the result is always a value that occurred, never one between two. The
 * median of an even count is the lower of the two middle values, 0 gives the
 * smallest and 100 the largest. The rank multiplies before it divides: dividing
 * first turns 14 percent of 50 values into 7.000000000000001, and the rank
 * would jump to 8.
 */
export function percentile(
  values: Arr.NonEmptyReadonlyArray<number>,
  percent: number
) {
  const rank = Num.clamp({ maximum: values.length, minimum: 1 })(
    Math.ceil((percent * values.length) / 100)
  );
  return Arr.getUnsafe(Arr.sort(values, Order.Number), rank - 1);
}

/**
 * How a turn stands: `open` while its phase is active, which is exactly while it
 * is queued or running, otherwise the status it settled with.
 */
function standing(turn: NinaTurnsDoc) {
  return turn.phase === "active" ? "open" : turn.state.status;
}

/**
 * The spread of one stage over the turns that hold its wait. A turn that never
 * reached the stage holds no wait for it, and is left out rather than counted
 * as zero.
 */
function stageSpread(turns: readonly NinaTurnsDoc[], stage: Stage) {
  const waits = Arr.flatMap(turns, (turn) =>
    Arr.fromNullishOr(turn.timing?.[stage])
  );
  if (!Arr.isReadonlyArrayNonEmpty(waits)) {
    return { stage, turns: 0 };
  }
  return {
    max: percentile(waits, 100),
    median: percentile(waits, 50),
    min: percentile(waits, 0),
    p90: percentile(waits, 90),
    stage,
    turns: waits.length,
  };
}

/**
 * Summarizes the waits that `turns` stored, with one row for each stage the
 * contract stores. It keeps no turn, chat or learner and none of their text.
 */
export function summarizeWaits(turns: readonly NinaTurnsDoc[]) {
  const times = Arr.map(turns, (turn) => turn._creationTime);
  const count = (status: ReturnType<typeof standing>) =>
    Arr.countBy(turns, (turn) => standing(turn) === status);
  return {
    read: turns.length,
    ...(Arr.isReadonlyArrayNonEmpty(times)
      ? {
          newest: Arr.max(times, Order.Number),
          oldest: Arr.min(times, Order.Number),
        }
      : {}),
    statuses: {
      cancelled: count("cancelled"),
      complete: count("complete"),
      failed: count("failed"),
      open: count("open"),
    },
    waits: Arr.map(Struct.keys(NinaTurnTiming.fields), (stage) =>
      stageSpread(turns, stage)
    ),
  };
}
