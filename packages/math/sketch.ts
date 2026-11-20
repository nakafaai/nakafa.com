import { Array as Arr, Option, Order, Schema } from "effect";

/** One point of a learner's sketch, in the graph's own units. */
export const SketchPointSchema = Schema.Struct({
  x: Schema.Finite,
  y: Schema.Finite,
});
export type SketchPoint = typeof SketchPointSchema.Type;

/** One stroke of a sketch, its points in the order the learner drew them. */
export const SketchStrokeSchema = Schema.NonEmptyArray(SketchPointSchema);
export type SketchStroke = typeof SketchStrokeSchema.Type;

/** Which way a part of the graph goes from left to right. */
export const SketchDirectionSchema = Schema.Literals([
  "falling",
  "level",
  "rising",
]);
export type SketchDirection = typeof SketchDirectionSchema.Type;

/** A point where the graph turns: a local maximum or minimum. */
export const SketchTurnSchema = Schema.Struct({
  kind: Schema.Literals(["maximum", "minimum"]),
  x: Schema.Finite,
  y: Schema.Finite,
});
export type SketchTurn = typeof SketchTurnSchema.Type;

/**
 * Where the graph meets the x-axis: it crosses, touches and turns back, ends
 * there, or runs along it.
 */
export const SketchZeroSchema = Schema.Struct({
  kind: Schema.Literals(["along", "cross", "end", "touch"]),
  x: Schema.Finite,
});
export type SketchZero = typeof SketchZeroSchema.Type;

/** One end of the graph and which way the graph goes there. */
export const SketchEndSchema = Schema.Struct({
  direction: SketchDirectionSchema,
  x: Schema.Finite,
  y: Schema.Finite,
});
export type SketchEnd = typeof SketchEndSchema.Type;

/** One stretch of the graph between its ends and turns, and which way it goes. */
export const SketchIntervalSchema = Schema.Struct({
  direction: SketchDirectionSchema,
  from: Schema.Finite,
  to: Schema.Finite,
});
export type SketchInterval = typeof SketchIntervalSchema.Type;

/** The key features of a sketched graph, read exactly from its points. */
export const SketchFeaturesSchema = Schema.Struct({
  /** Where each stroke starts and ends along the x-axis, left to right. */
  branches: Schema.Array(
    Schema.Struct({ from: Schema.Finite, to: Schema.Finite })
  ),
  /** The left end of the first stroke and the right end of the last. */
  ends: Schema.Struct({ left: SketchEndSchema, right: SketchEndSchema }),
  /** The turning points, left to right. */
  extrema: Schema.Array(SketchTurnSchema),
  /** Each stretch between ends and turns, left to right. */
  intervals: Schema.Array(SketchIntervalSchema),
  /** Whether each x has one point: no stroke doubles back and no two strokes overlap. */
  isFunction: Schema.Boolean,
  /** Where the graph crosses the y-axis, when a stroke spans x = 0. */
  yIntercept: Schema.Option(Schema.Finite),
  /** Where the graph meets the x-axis, left to right. */
  zeros: Schema.Array(SketchZeroSchema),
});
export type SketchFeatures = typeof SketchFeaturesSchema.Type;

/** The search for turning points: the trend so far, its farthest point, and the turns found. */
const TurnSearchSchema = Schema.Struct({
  extreme: SketchPointSchema,
  high: SketchPointSchema,
  low: SketchPointSchema,
  trend: Schema.Literals(["falling", "none", "rising"]),
  turns: Schema.Array(SketchTurnSchema),
});
type TurnSearch = typeof TurnSearchSchema.Type;

/** A sample of a stroke with its index and its side of the band around zero. */
const BandedSchema = Schema.Struct({
  band: Schema.Literals([-1, 0, 1]),
  index: Schema.Finite,
  point: SketchPointSchema,
});
type Banded = typeof BandedSchema.Type;

/** How many samples the graph takes per tolerance along the x-axis. */
const SAMPLES_PER_TOLERANCE = 4;

/** Each item with the one after it. */
function pairs<A>(items: readonly A[]) {
  return Arr.zip(items, Arr.drop(items, 1));
}

/** A stroke drawn from left to right, whichever way the learner drew it. */
function leftToRight(
  stroke: SketchStroke
): Arr.NonEmptyReadonlyArray<SketchPoint> {
  return Arr.lastNonEmpty(stroke).x < Arr.headNonEmpty(stroke).x
    ? Arr.reverse(stroke)
    : stroke;
}

/** Whether a stroke, read left to right, goes back along the x-axis by more than the tolerance. */
function doublesBack(stroke: SketchStroke, tolerance: number) {
  return Arr.reduce(
    leftToRight(stroke),
    { back: false, reach: Number.NEGATIVE_INFINITY },
    (state, point) => ({
      back: state.back || point.x < state.reach - tolerance,
      reach: Math.max(state.reach, point.x),
    })
  ).back;
}

/** The points of a stroke that move right, so each x has one value. */
function forward(points: Arr.NonEmptyReadonlyArray<SketchPoint>) {
  return Arr.reduce(
    Arr.tailNonEmpty(points),
    Arr.of(Arr.headNonEmpty(points)),
    (kept, point) =>
      point.x > Arr.lastNonEmpty(kept).x ? Arr.append(kept, point) : kept
  );
}

/** Where the segment from a to b reaches a given x, by straight interpolation. */
function along(a: SketchPoint, b: SketchPoint, x: number): SketchPoint {
  return { x, y: a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x) };
}

/** The stroke sampled every `step` along the x-axis from its first point, ending at its last. */
function resample(
  points: Arr.NonEmptyReadonlyArray<SketchPoint>,
  step: number
) {
  const origin = Arr.headNonEmpty(points).x;
  const inner = Arr.flatMap(pairs(points), ([a, b]) => {
    const first = Math.ceil((a.x - origin) / step);
    const count = Math.ceil((b.x - origin) / step) - first;
    return count <= 0
      ? []
      : Arr.makeBy(count, (index) =>
          along(a, b, origin + (first + index) * step)
        );
  });
  return Arr.append(inner, Arr.lastNonEmpty(points));
}

/** Starts a trend once the graph has moved more than the tolerance from its lowest or highest point so far. */
function startTrend(
  search: TurnSearch,
  point: SketchPoint,
  tolerance: number
): TurnSearch {
  const high = point.y > search.high.y ? point : search.high;
  const low = point.y < search.low.y ? point : search.low;
  if (point.y - low.y > tolerance) {
    return { ...search, extreme: point, high, low, trend: "rising" };
  }
  if (high.y - point.y > tolerance) {
    return { ...search, extreme: point, high, low, trend: "falling" };
  }
  return { ...search, high, low };
}

/** Follows a trend, and records a turn once the graph comes back by more than the tolerance. */
function followTrend(
  search: TurnSearch,
  point: SketchPoint,
  tolerance: number
): TurnSearch {
  const rising = search.trend === "rising";
  const further = rising
    ? point.y >= search.extreme.y
    : point.y <= search.extreme.y;
  if (further) {
    return { ...search, extreme: point };
  }
  if (Math.abs(search.extreme.y - point.y) <= tolerance) {
    return search;
  }
  return {
    ...search,
    extreme: point,
    trend: rising ? "falling" : "rising",
    turns: Arr.append(search.turns, {
      kind: rising ? "maximum" : "minimum",
      x: search.extreme.x,
      y: search.extreme.y,
    }),
  };
}

/**
 * The turning points of a sampled graph that rises or falls by more than the
 * tolerance on both sides, so the wobble of a hand never counts as a turn.
 */
function turningPoints(
  samples: Arr.NonEmptyReadonlyArray<SketchPoint>,
  tolerance: number
) {
  const first = Arr.headNonEmpty(samples);
  const start: TurnSearch = {
    extreme: first,
    high: first,
    low: first,
    trend: "none",
    turns: [],
  };
  return Arr.reduce(Arr.tailNonEmpty(samples), start, (search, point) =>
    search.trend === "none"
      ? startTrend(search, point, tolerance)
      : followTrend(search, point, tolerance)
  ).turns;
}

/** Which way a stretch with no turn goes: by how far its end lies above or below its start. */
function directionOf(rise: number, tolerance: number): SketchDirection {
  if (rise > tolerance) {
    return "rising";
  }
  return rise < -tolerance ? "falling" : "level";
}

/** The way a graph goes on its way to a turn. */
function towards(turn: SketchTurn): SketchDirection {
  return turn.kind === "maximum" ? "rising" : "falling";
}

/** The way a graph goes away from a turn. */
function awayFrom(turn: SketchTurn): SketchDirection {
  return turn.kind === "maximum" ? "falling" : "rising";
}

/** One branch of a sketch: its samples, its turns, its stretches and where it meets the x-axis. */
function readBranch(stroke: SketchStroke, tolerance: number) {
  const samples = resample(
    forward(leftToRight(stroke)),
    tolerance / SAMPLES_PER_TOLERANCE
  );
  const first = Arr.headNonEmpty(samples);
  const last = Arr.lastNonEmpty(samples);
  const turns = turningPoints(samples, tolerance);
  const plain = directionOf(last.y - first.y, tolerance);
  const stops = Arr.append(
    Arr.prepend(
      Arr.map(turns, (turn) => turn.x),
      first.x
    ),
    last.x
  );
  const intervals = Arr.map(
    pairs(stops),
    ([from, to], index): SketchInterval => ({
      direction: Option.match(Arr.get(turns, index), {
        // Past the last turn the graph goes away from it; with no turn, by its ends.
        onNone: () =>
          Option.match(Arr.last(turns), {
            onNone: () => plain,
            onSome: awayFrom,
          }),
        onSome: towards,
      }),
      from,
      to,
    })
  );
  return {
    first: {
      direction: Option.match(Arr.head(turns), {
        onNone: () => plain,
        onSome: towards,
      }),
      x: first.x,
      y: first.y,
    },
    intervals,
    last: {
      direction: Option.match(Arr.last(turns), {
        onNone: () => plain,
        onSome: awayFrom,
      }),
      x: last.x,
      y: last.y,
    },
    samples,
    turns,
    zeros: zerosOf(samples, tolerance),
  };
}

/** The side of the band of the tolerance around zero that a value lies on: above, inside or below. */
function bandOf(y: number, tolerance: number): Banded["band"] {
  if (y > tolerance) {
    return 1;
  }
  return y < -tolerance ? -1 : 0;
}

/** The point of a run closest to the x-axis. */
function closest(run: Arr.NonEmptyReadonlyArray<Banded>) {
  return Arr.reduce(
    Arr.tailNonEmpty(run),
    Arr.headNonEmpty(run).point,
    (best, entry) =>
      Math.abs(entry.point.y) < Math.abs(best.y) ? entry.point : best
  );
}

/** Where the graph changes sign between two samples, by straight interpolation. */
function crossing(
  samples: readonly SketchPoint[],
  from: number,
  to: number
): readonly SketchZero[] {
  return Option.toArray(
    Option.map(
      Arr.findFirst(
        pairs(Arr.take(Arr.drop(samples, from), to - from + 1)),
        ([a, b]) => a.y <= 0 !== b.y <= 0
      ),
      ([a, b]): SketchZero => ({
        kind: "cross",
        x: a.x + ((0 - a.y) * (b.x - a.x)) / (b.y - a.y),
      })
    )
  );
}

/**
 * Where a sampled stroke meets the x-axis. The graph lies above, inside or below
 * a band of the tolerance around zero. It crosses when it goes from above to
 * below or back, touches when it enters the band and returns to the side it came
 * from, ends inside the band, or lies in it whole.
 */
function zerosOf(
  samples: Arr.NonEmptyReadonlyArray<SketchPoint>,
  tolerance: number
): readonly SketchZero[] {
  const runs = Arr.groupWith(
    Arr.map(
      samples,
      (point, index): Banded => ({
        band: bandOf(point.y, tolerance),
        index,
        point,
      })
    ),
    (a, b) => a.band === b.band
  );
  return Arr.flatMap(runs, (run, at): readonly SketchZero[] => {
    const head = Arr.headNonEmpty(run);
    const previous = Arr.get(runs, at - 1);
    const next = Arr.get(runs, at + 1);
    if (head.band !== 0) {
      // Straight from above to below, or back, with no sample inside the band.
      return Option.match(
        Option.filter(
          next,
          (after) => Arr.headNonEmpty(after).band === -head.band
        ),
        {
          onNone: () => [],
          onSome: (after) =>
            crossing(
              samples,
              Arr.lastNonEmpty(run).index,
              Arr.headNonEmpty(after).index
            ),
        }
      );
    }
    const nearest = closest(run);
    if (Option.isNone(previous) || Option.isNone(next)) {
      const kind =
        Option.isNone(previous) && Option.isNone(next) ? "along" : "end";
      return [{ kind, x: nearest.x }];
    }
    const before = Arr.lastNonEmpty(previous.value);
    const after = Arr.headNonEmpty(next.value);
    return before.band === after.band
      ? [{ kind: "touch", x: nearest.x }]
      : crossing(samples, before.index, after.index);
  });
}

/** Where a sampled stroke crosses the y-axis, when it spans x = 0. */
function interceptOf(samples: readonly SketchPoint[]) {
  return Option.map(
    Arr.findFirst(pairs(samples), ([a, b]) => a.x <= 0 && b.x >= 0),
    ([a, b]) => along(a, b, 0).y
  );
}

/** Orders features along the x-axis. */
const byX = Order.mapInput(
  Order.Number,
  (feature: SketchTurn | SketchZero) => feature.x
);

/** Orders branches by where they start along the x-axis. */
const byStart = Order.mapInput(
  Order.Number,
  (branch: ReturnType<typeof readBranch>) => branch.first.x
);

/**
 * Reads the key features of a sketched graph exactly from its strokes: where it
 * meets the x-axis, where it crosses the y-axis, where it turns, which way each
 * stretch goes, how it ends, and whether it is a function at all. Every
 * judgement uses one tolerance in the graph's own units, so a wobble of the hand
 * smaller than it is never a feature, at whatever zoom it was drawn. A grader
 * compares these features with the answer's and never sees pixels.
 */
export function sketchFeatures(
  strokes: Arr.NonEmptyReadonlyArray<SketchStroke>,
  tolerance: number
): SketchFeatures {
  const branches = Arr.sort(
    Arr.map(strokes, (stroke) => readBranch(stroke, tolerance)),
    byStart
  );
  const overlaps = Arr.some(
    pairs(branches),
    ([left, right]) => right.first.x < left.last.x - tolerance
  );
  return {
    branches: Arr.map(branches, (branch) => ({
      from: branch.first.x,
      to: branch.last.x,
    })),
    ends: {
      left: Arr.headNonEmpty(branches).first,
      right: Arr.lastNonEmpty(branches).last,
    },
    extrema: Arr.sort(
      Arr.flatMap(branches, (branch) => branch.turns),
      byX
    ),
    intervals: Arr.flatMap(branches, (branch) => branch.intervals),
    isFunction: !(
      overlaps || Arr.some(strokes, (stroke) => doublesBack(stroke, tolerance))
    ),
    yIntercept: Arr.findFirst(branches, (branch) =>
      interceptOf(branch.samples)
    ),
    zeros: Arr.sort(
      Arr.flatMap(branches, (branch) => branch.zeros),
      byX
    ),
  };
}
