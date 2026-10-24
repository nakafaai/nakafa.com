// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  CURVE_SAMPLES_PER_BRANCH,
  type Curve,
  CurveSchema,
  sampleCurve,
  TANGENT_Y_LIMIT,
} from "@repo/design-system/components/contents/mathematics/line/curve";
import type { Point3 } from "@repo/design-system/lib/geometry/point";
import { Array as Arr, Option, Schema } from "effect";

const TWO_PI = 2 * Math.PI;
const CLOSE_ENOUGH = 1e-9;

/** The closed form `amplitude * f(frequency * x + phase) + shift` of one curve. */
function closedForm(curve: Curve, f: (argument: number) => number) {
  return (x: number) =>
    curve.amplitude * f(curve.frequency * x + curve.phase) + curve.shift;
}

/** The first point of one branch, which every branch of these tests has. */
function firstOf(points: readonly Point3[]) {
  return Option.getOrThrow(Arr.head(points));
}

/** The last point of one branch, which every branch of these tests has. */
function lastOf(points: readonly Point3[]) {
  return Option.getOrThrow(Arr.last(points));
}

/** The branch at one position, which the tests name by its order in x. */
function branchAt(branches: readonly (readonly Point3[])[], index: number) {
  return Option.getOrThrow(Arr.get(branches, index));
}

/** The sine of the lesson, `y = 2 sin x` over two periods. */
const SINE: Curve = {
  amplitude: 2,
  domain: [-TWO_PI, TWO_PI],
  frequency: 1,
  kind: "sin",
  phase: 0,
  shift: 0,
};

/** The tangent of the lesson, `y = tan x` between -pi and pi. */
const TANGENT: Curve = {
  amplitude: 1,
  domain: [-Math.PI, Math.PI],
  frequency: 1,
  kind: "tan",
  phase: 0,
  shift: 0,
};

/** The largest gap between one chord and the sine at the chord's middle. */
function maximumChordDeviation(points: readonly Point3[], curve: Curve) {
  const at = closedForm(curve, Math.sin);
  const chords = Arr.zip(points, Arr.drop(points, 1));
  const gaps = Arr.map(chords, ([previous, next]) =>
    Math.abs((previous.y + next.y) / 2 - at((previous.x + next.x) / 2))
  );
  return Arr.reduce(gaps, 0, (largest, gap) => Math.max(largest, gap));
}

describe("curve sampling", () => {
  it("samples a sine as one branch of at least 200 points on its closed form", () => {
    const branches = sampleCurve(SINE);
    const branch = branchAt(branches, 0);

    expect(branches).toHaveLength(1);
    expect(branch).toHaveLength(CURVE_SAMPLES_PER_BRANCH);
    expect(CURVE_SAMPLES_PER_BRANCH).toBeGreaterThanOrEqual(200);
    expect(firstOf(branch).x).toBe(-TWO_PI);
    expect(lastOf(branch).x).toBe(TWO_PI);
    for (const point of branch) {
      expect(point.z).toBe(0);
      expect(Math.abs(point.y - 2 * Math.sin(point.x))).toBeLessThan(
        CLOSE_ENOUGH
      );
    }
  });

  it("keeps every chord of a shallow sine within 0.01 axis units of the curve", () => {
    const branch = branchAt(sampleCurve(SINE), 0);

    expect(maximumChordDeviation(branch, SINE)).toBeLessThan(0.01);
  });

  it("applies phase, shift and a negative amplitude of a cosine", () => {
    const curve: Curve = {
      amplitude: -1.5,
      domain: [0, 3],
      frequency: 2,
      kind: "cos",
      phase: Math.PI / 2,
      shift: 3,
    };
    const branch = branchAt(sampleCurve(curve), 0);
    const at = closedForm(curve, Math.cos);

    expect(lastOf(branch).x).toBe(3);
    for (const point of branch) {
      expect(Math.abs(point.y - at(point.x))).toBeLessThan(CLOSE_ENOUGH);
    }
  });

  it("splits a tangent at each asymptote and clips every branch to the y limit", () => {
    const branches = sampleCurve(TANGENT);
    const at = closedForm(TANGENT, Math.tan);

    expect(branches).toHaveLength(3);
    for (const branch of branches) {
      expect(branch.length).toBeGreaterThanOrEqual(200);
      for (const point of branch) {
        expect(Math.abs(point.y - at(point.x))).toBeLessThan(CLOSE_ENOUGH);
        expect(Math.abs(point.y)).toBeLessThanOrEqual(
          TANGENT_Y_LIMIT + CLOSE_ENOUGH
        );
      }
    }
    const left = branchAt(branches, 0);
    const middle = branchAt(branches, 1);
    const right = branchAt(branches, 2);
    expect(firstOf(left).x).toBe(-Math.PI);
    expect(lastOf(left).y).toBeCloseTo(TANGENT_Y_LIMIT, 9);
    expect(firstOf(middle).y).toBeCloseTo(-TANGENT_Y_LIMIT, 9);
    expect(lastOf(middle).y).toBeCloseTo(TANGENT_Y_LIMIT, 9);
    expect(firstOf(right).y).toBeCloseTo(-TANGENT_Y_LIMIT, 9);
    expect(lastOf(right).x).toBe(Math.PI);
  });

  it("follows a tangent with frequency, phase and a negative amplitude", () => {
    const curve: Curve = {
      amplitude: -2,
      domain: [0, 2],
      frequency: 2,
      kind: "tan",
      phase: 1,
      shift: 1,
    };
    const branches = sampleCurve(curve);
    const at = closedForm(curve, Math.tan);

    expect(branches).toHaveLength(2);
    for (const branch of branches) {
      for (const point of branch) {
        expect(Math.abs(point.y - at(point.x))).toBeLessThan(CLOSE_ENOUGH);
        expect(Math.abs(point.y - curve.shift)).toBeLessThanOrEqual(
          TANGENT_Y_LIMIT + Math.abs(curve.shift) + CLOSE_ENOUGH
        );
      }
    }
  });

  it("returns no branch when the y limit excludes the whole domain", () => {
    expect(sampleCurve({ ...TANGENT, domain: [1.5, 1.55] })).toEqual([]);
  });
});

describe("curve schema", () => {
  it("accepts a curve with a nonzero frequency and an increasing domain", () => {
    expect(Schema.is(CurveSchema)(SINE)).toBe(true);
  });

  it("rejects a zero frequency, a zero amplitude and a reversed domain", () => {
    expect(Schema.is(CurveSchema)({ ...SINE, frequency: 0 })).toBe(false);
    expect(Schema.is(CurveSchema)({ ...SINE, amplitude: 0 })).toBe(false);
    expect(Schema.is(CurveSchema)({ ...SINE, domain: [2, 1] })).toBe(false);
    expect(Schema.is(CurveSchema)({ ...SINE, kind: "exp" })).toBe(false);
  });
});
