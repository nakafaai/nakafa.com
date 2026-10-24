import type { Point3 } from "@repo/design-system/lib/geometry/point";
import { Array as Arr, Schema } from "effect";

/**
 * The samples of one branch. Decision 42 requires at least 200; 400 keeps the
 * chord between neighbouring samples of a sine within 0.01 axis units even at
 * amplitude 2 over two periods.
 */
export const CURVE_SAMPLES_PER_BRANCH = 400;

/**
 * The y limit that a tangent branch is clipped to. A tangent has no finite value
 * at its asymptotes, so the drawn branch stops at the vertical extent of the
 * lesson's asymptote guides, which span from -6 to 6.
 */
export const TANGENT_Y_LIMIT = 6;

const NonZeroFiniteSchema = Schema.Finite.check(
  Schema.makeFilter((value) => value !== 0, {
    message: "Expected a nonzero finite number.",
  })
);

/** The family of one curve: its sine, its cosine or its tangent. */
export const CurveKindSchema = Schema.Literals(["sin", "cos", "tan"]);

/**
 * One curve `y = amplitude * f(frequency * x + phase) + shift` over its domain,
 * where `f` is named by `kind`. The component computes every point from this
 * formula in the browser, so a lesson carries the formula instead of its samples.
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
  shift: Schema.Finite,
});

/** One curve declared by its formula. */
export type Curve = typeof CurveSchema.Type;

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

/** Evenly spaced x values across one interval, with both of its ends included. */
function evenSamples(from: number, to: number): number[] {
  const last = CURVE_SAMPLES_PER_BRANCH - 1;
  return Arr.makeBy(CURVE_SAMPLES_PER_BRANCH, (index) =>
    index === last ? to : from + ((to - from) * index) / last
  );
}

/** The sine or cosine as one branch over its whole domain. */
function sampleSmooth(curve: Curve): Point3[][] {
  const [from, to] = curve.domain;
  return [Arr.map(evenSamples(from, to), (x) => curvePoint(curve, x))];
}

/**
 * The argument interval of the tangent branch that stays within the y limit. The
 * branch reaches the limit where `amplitude * tan(u) + shift` equals plus or minus
 * the limit, so `u` runs between the two arctangents of those values.
 */
function clippedArgument(curve: Curve): readonly [number, number] {
  const lower = (-TANGENT_Y_LIMIT - curve.shift) / curve.amplitude;
  const upper = (TANGENT_Y_LIMIT - curve.shift) / curve.amplitude;
  return [Math.atan(Math.min(lower, upper)), Math.atan(Math.max(lower, upper))];
}

/**
 * The clipped branch of one period of the tangent, or undefined when the domain
 * does not reach it. The branch lies between two asymptotes, so it never crosses one.
 */
function tangentBranch(
  curve: Curve,
  period: number,
  [clipStart, clipEnd]: readonly [number, number]
): Point3[] | undefined {
  const [from, to] = curve.domain;
  const offset = period * Math.PI;
  const inverse = (argument: number) =>
    (argument - curve.phase) / curve.frequency;
  const first = inverse(offset + clipStart);
  const second = inverse(offset + clipEnd);
  const lower = Math.max(from, Math.min(first, second));
  const upper = Math.min(to, Math.max(first, second));
  if (!(lower < upper)) {
    return undefined;
  }
  return Arr.map(evenSamples(lower, upper), (x) => curvePoint(curve, x));
}

/**
 * The tangent as one branch per stretch between asymptotes inside its domain.
 * Each branch is clipped to the y limit, so the first and last points of a branch
 * that leaves the limit lie exactly on it.
 */
function sampleTangent(curve: Curve): Point3[][] {
  const [from, to] = curve.domain;
  const clip = clippedArgument(curve);
  const argumentFrom = curve.frequency * from + curve.phase;
  const argumentTo = curve.frequency * to + curve.phase;
  const lowest = Math.min(argumentFrom, argumentTo);
  const highest = Math.max(argumentFrom, argumentTo);
  const firstPeriod = Math.floor((lowest - clip[1]) / Math.PI);
  const lastPeriod = Math.ceil((highest - clip[0]) / Math.PI);
  const periods = Arr.makeBy(
    lastPeriod - firstPeriod + 1,
    (index) => firstPeriod + index
  );
  return Arr.flatMap(periods, (period) => {
    const branch = tangentBranch(curve, period, clip);
    return branch === undefined ? [] : [branch];
  });
}

/**
 * Samples one curve into its branches, each a polyline of computed points. A sine
 * or cosine is one branch over its domain. A tangent is one branch per stretch
 * between asymptotes, clipped to the y limit, and a domain that stays beyond the
 * limit yields no branch.
 */
export function sampleCurve(curve: Curve): Point3[][] {
  if (curve.kind === "tan") {
    return sampleTangent(curve);
  }
  return sampleSmooth(curve);
}
