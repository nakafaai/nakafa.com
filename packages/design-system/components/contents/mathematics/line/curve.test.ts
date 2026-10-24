// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
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

/** The x of the sample at `index` on the grid of a curve, which has `samples` values. */
function gridX(curve: Curve, samples: number, index: number) {
  const [from, to] = curve.domain;
  return from + ((to - from) * index) / (samples - 1);
}

/** The first element of one branch, which every branch of these tests has. */
function firstOf<A>(items: readonly A[]) {
  return Option.getOrThrow(Arr.head(items));
}

/** The last element of one branch, which every branch of these tests has. */
function lastOf<A>(items: readonly A[]) {
  return Option.getOrThrow(Arr.last(items));
}

/** The branch at one position, which the tests name by its order in x. */
function branchAt<A>(branches: readonly A[], index: number) {
  return Option.getOrThrow(Arr.get(branches, index));
}

/** The sine of the lesson, `y = 2 sin x` over two periods, on the default grid. */
const SINE: Curve = {
  amplitude: 2,
  domain: [-TWO_PI, TWO_PI],
  frequency: 1,
  kind: "sin",
  phase: 0,
  shift: 0,
};

/** The tangent of the lesson, `y = tan x` between -pi and pi, on the default grid. */
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
  it("samples a sine on the grid of its declared samples, both ends included", () => {
    const curve: Curve = { ...SINE, samples: 298 };
    const branches = sampleCurve(curve);
    const branch = branchAt(branches, 0);
    const at = closedForm(curve, Math.sin);

    expect(branches).toHaveLength(1);
    expect(branch.points).toHaveLength(298);
    expect(branch.indices).toEqual(Arr.makeBy(298, (index) => index));
    expect(firstOf(branch.points).x).toBe(-TWO_PI);
    expect(lastOf(branch.points).x).toBe(TWO_PI);
    Arr.forEach(branch.points, (point, index) => {
      expect(point.z).toBe(0);
      expect(Math.abs(point.x - gridX(curve, 298, index))).toBeLessThan(
        CLOSE_ENOUGH
      );
      expect(Math.abs(point.y - at(point.x))).toBeLessThan(CLOSE_ENOUGH);
    });
  });

  it("places an anchored tangent sample at its grid position on the middle branch", () => {
    const curve: Curve = { ...TANGENT, samples: 322 };
    const branch = branchAt(sampleCurve(curve), 1);
    const local = Option.getOrThrow(
      Arr.findFirstIndex(branch.indices, (index) => index === 162)
    );

    expect(
      Math.abs(branchAt(branch.points, local).x - gridX(curve, 322, 162))
    ).toBeLessThan(CLOSE_ENOUGH);
  });

  it("defaults a curve to 200 samples when its declaration names none", () => {
    expect(branchAt(sampleCurve(SINE), 0).points).toHaveLength(200);
  });

  it("keeps every chord of a shallow sine within 0.01 axis units of the curve", () => {
    const branch = branchAt(sampleCurve(SINE), 0);

    expect(maximumChordDeviation(branch.points, SINE)).toBeLessThan(0.01);
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

    expect(lastOf(branch.points).x).toBe(3);
    for (const point of branch.points) {
      expect(Math.abs(point.y - at(point.x))).toBeLessThan(CLOSE_ENOUGH);
    }
  });

  it("splits a tangent at each asymptote and clips every branch to the y limit", () => {
    const branches = sampleCurve(TANGENT);
    const at = closedForm(TANGENT, Math.tan);

    expect(branches).toHaveLength(3);
    for (const branch of branches) {
      for (const point of branch.points) {
        expect(Math.abs(point.y - at(point.x))).toBeLessThan(CLOSE_ENOUGH);
        expect(Math.abs(point.y)).toBeLessThanOrEqual(
          TANGENT_Y_LIMIT + CLOSE_ENOUGH
        );
      }
    }
    const left = branchAt(branches, 0).points;
    const middle = branchAt(branches, 1).points;
    const right = branchAt(branches, 2).points;
    expect(firstOf(left).x).toBe(-Math.PI);
    expect(lastOf(left).y).toBeCloseTo(TANGENT_Y_LIMIT, 9);
    expect(firstOf(middle).y).toBeCloseTo(-TANGENT_Y_LIMIT, 9);
    expect(lastOf(middle).y).toBeCloseTo(TANGENT_Y_LIMIT, 9);
    expect(firstOf(right).y).toBeCloseTo(-TANGENT_Y_LIMIT, 9);
    expect(lastOf(right).x).toBe(Math.PI);
  });

  it("indexes exactly the grid samples inside the y limit, and no clip point", () => {
    const curve: Curve = { ...TANGENT, samples: 322 };
    const branches = sampleCurve(curve);
    const at = closedForm(curve, Math.tan);
    const inside = Arr.filter(
      Arr.makeBy(322, (index) => index),
      (index) => Math.abs(at(gridX(curve, 322, index))) <= TANGENT_Y_LIMIT
    );
    const indexed = Arr.flatMap(branches, (branch) =>
      Arr.filter(branch.indices, (index) => index !== undefined)
    );

    expect(indexed).toEqual(inside);
    expect(lastOf(branchAt(branches, 0).indices)).toBeUndefined();
    expect(firstOf(branchAt(branches, 2).indices)).toBeUndefined();
  });

  it("clips a tangent whose domain ends beyond the limit at the limit itself", () => {
    const curve: Curve = { ...TANGENT, domain: [-1.5, 1.5] };
    const branches = sampleCurve(curve);
    const branch = branchAt(branches, 0);
    const at = closedForm(curve, Math.tan);

    expect(branches).toHaveLength(1);
    expect(firstOf(branch.points).y).toBeCloseTo(-TANGENT_Y_LIMIT, 9);
    expect(lastOf(branch.points).y).toBeCloseTo(TANGENT_Y_LIMIT, 9);
    for (const point of branch.points) {
      expect(Math.abs(point.y - at(point.x))).toBeLessThan(CLOSE_ENOUGH);
    }
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
      for (const point of branch.points) {
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

  it("accepts a whole number of samples from 200 up, and rejects a smaller or fractional count", () => {
    expect(Schema.is(CurveSchema)({ ...SINE, samples: 200 })).toBe(true);
    expect(Schema.is(CurveSchema)({ ...SINE, samples: 199 })).toBe(false);
    expect(Schema.is(CurveSchema)({ ...SINE, samples: 200.5 })).toBe(false);
  });
});
