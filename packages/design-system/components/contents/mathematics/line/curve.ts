import {
  type Point3,
  Point3Schema,
} from "@repo/design-system/lib/geometry/point";
import { Array as Arr, Schema } from "effect";

/**
 * The samples of a curve whose declaration names none. Decision 44 sets this as the
 * default, and as the least count that `samples` accepts.
 */
const DEFAULT_CURVE_SAMPLES = 200;

/**
 * The y limit that a tangent branch is clipped to: the height of the asymptote guides
 * that the lessons draw, which run from -6 to 6. The limit is the graph's and is shared
 * by every tangent, so a lesson with other guides needs the limit declared in the Schema.
 */
export const TANGENT_Y_LIMIT = 6;

const NonZeroFiniteSchema = Schema.Finite.check(
  Schema.makeFilter((value) => value !== 0, {
    message: "Expected a nonzero finite number.",
  })
);

/** The family of one curve: its sine, its cosine or its tangent. */
const CurveKindSchema = Schema.Literals(["sin", "cos", "tan"]);

/** The grid of one curve: a whole number of samples, at least the default. */
const CurveSamplesSchema = Schema.Int.check(
  Schema.isGreaterThanOrEqualTo(DEFAULT_CURVE_SAMPLES)
);

/**
 * One curve `y = amplitude * f(frequency * x + phase) + shift` over its domain, where `f` is
 * named by `kind`. The component computes every point from this formula in the browser, so a
 * lesson carries the formula instead of its samples. `samples` sets the grid that the points
 * sit on, and a label's anchor indexes that grid.
 */
export const CurveSchema = Schema.Struct({
  amplitude: NonZeroFiniteSchema,
  domain: Schema.Tuple([Schema.Finite, Schema.Finite]).check(
    Schema.makeFilter(([from, to]) => from < to, {
      message: "Expected a domain whose start is below its end.",
    })
  ),
  frequency: NonZeroFiniteSchema,
  kind: CurveKindSchema,
  phase: Schema.Finite,
  samples: Schema.optionalKey(CurveSamplesSchema),
  shift: Schema.Finite,
});

/** One curve declared by its formula. */
export type Curve = typeof CurveSchema.Type;

/** A curve that cannot be drawn: its declaration is invalid, or a label anchor is on no drawn branch. */
export class CurveError extends Schema.TaggedError<CurveError>()("CurveError", {
  message: Schema.String,
}) {}

/**
 * One drawn branch of a curve: a polyline in x order, with the grid index of each point.
 * A clip point, where the y limit cuts a segment between two samples, has no index,
 * because a label anchor names a grid sample only.
 */
const CurveBranchSchema = Schema.Struct({
  indices: Schema.Array(Schema.UndefinedOr(Schema.Int)),
  points: Schema.mutable(Schema.Array(Point3Schema)),
});

/** One drawn branch of a curve. */
export type CurveBranch = typeof CurveBranchSchema.Type;

/** The function `f` of each curve kind, in radians. */
const FAMILY_FUNCTION: Record<Curve["kind"], (argument: number) => number> = {
  cos: Math.cos,
  sin: Math.sin,
  tan: Math.tan,
};

/** The point of the curve at one x, computed from its formula. */
function curvePoint(curve: Curve, x: number): Point3 {
  const argument = curve.frequency * x + curve.phase;
  return {
    x,
    y: curve.amplitude * FAMILY_FUNCTION[curve.kind](argument) + curve.shift,
    z: 0,
  };
}

/**
 * The x of each grid sample: `samples` values evenly spaced across the domain, with both
 * ends included. Decision 44 spaces a tangent evenly in `frequency * x + phase`, which is
 * affine in x, so the same x values form the even grid of every family.
 */
function gridXs(curve: Curve, samples: number): number[] {
  const [from, to] = curve.domain;
  const last = samples - 1;
  return Arr.makeBy(samples, (index) =>
    index === last ? to : from + ((to - from) * index) / last
  );
}

/** The sine or cosine as one branch over its whole domain, with every sample indexed. */
function sampleSmooth(curve: Curve, samples: number): CurveBranch[] {
  return [
    {
      indices: Arr.makeBy(samples, (index) => index),
      points: Arr.map(gridXs(curve, samples), (x) => curvePoint(curve, x)),
    },
  ];
}

/** One sample of a tangent grid, with the asymptote period that holds it. */
const TangentSampleSchema = Schema.Struct({
  index: Schema.Int,
  period: Schema.Int,
  point: Point3Schema,
});

/** One sample of a tangent grid. */
type TangentSample = typeof TangentSampleSchema.Type;

/**
 * The asymptote period of one x. The tangent is monotonic within a period, which runs from
 * one asymptote to the next, so the samples inside the y limit of a period form one run.
 */
function periodOf(curve: Curve, x: number): number {
  return Math.floor(
    (curve.frequency * x + curve.phase + Math.PI / 2) / Math.PI
  );
}

/**
 * The exact point where the tangent of one period reaches a y bound. Its argument solves
 * `amplitude * tan(u) + shift = bound` on that period, and the point is computed from the
 * formula like every other point of the curve.
 */
function boundPoint(curve: Curve, period: number, bound: number): Point3 {
  const argument =
    period * Math.PI + Math.atan((bound - curve.shift) / curve.amplitude);
  return curvePoint(curve, (argument - curve.phase) / curve.frequency);
}

/**
 * The branch of one period from its run of samples inside the y limit. The tangent enters
 * the limit at one bound and leaves it at the other, so a run that begins after the domain's
 * first sample starts at an exact clip point, and a run that ends before the last sample
 * ends at one.
 */
function clipRun(
  curve: Curve,
  samples: number,
  period: number,
  run: Arr.NonEmptyReadonlyArray<TangentSample>
): CurveBranch {
  // The tangent rises with x when its amplitude and frequency share a sign.
  const rising = curve.amplitude * curve.frequency > 0;
  const entering = rising ? -TANGENT_Y_LIMIT : TANGENT_Y_LIMIT;
  const leaving = -entering;
  const startClip =
    Arr.headNonEmpty(run).index > 0
      ? [boundPoint(curve, period, entering)]
      : [];
  const endClip =
    Arr.lastNonEmpty(run).index < samples - 1
      ? [boundPoint(curve, period, leaving)]
      : [];
  return {
    indices: [
      ...Arr.map(startClip, () => undefined),
      ...Arr.map(run, (sample) => sample.index),
      ...Arr.map(endClip, () => undefined),
    ],
    points: [
      ...startClip,
      ...Arr.map(run, (sample) => sample.point),
      ...endClip,
    ],
  };
}

/**
 * The tangent as one branch per stretch between asymptotes inside its domain. Every branch
 * keeps the grid index of its samples, and each end the y limit cuts is an exact clip point.
 */
function sampleTangent(curve: Curve, samples: number): CurveBranch[] {
  const grid: TangentSample[] = Arr.map(gridXs(curve, samples), (x, index) => ({
    index,
    period: periodOf(curve, x),
    point: curvePoint(curve, x),
  }));
  const periods = Arr.dedupe(Arr.map(grid, (sample) => sample.period));
  return Arr.flatMap(periods, (period) =>
    Arr.match(
      Arr.filter(
        grid,
        (sample) =>
          sample.period === period &&
          Math.abs(sample.point.y) <= TANGENT_Y_LIMIT
      ),
      {
        onEmpty: () => [],
        onNonEmpty: (run) => [clipRun(curve, samples, period, run)],
      }
    )
  );
}

/**
 * Samples one curve into its branches, each a polyline of computed points on the curve's grid
 * of `samples` values (decision 44). A sine or cosine is one branch over its domain. A tangent
 * is one branch per stretch between asymptotes, clipped to the y limit, and a domain that stays
 * beyond the limit yields no branch.
 */
export function sampleCurve(curve: Curve): CurveBranch[] {
  const samples = curve.samples ?? DEFAULT_CURVE_SAMPLES;
  if (curve.kind === "tan") {
    return sampleTangent(curve, samples);
  }
  return sampleSmooth(curve, samples);
}
