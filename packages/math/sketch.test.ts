import { describe, expect, it } from "@effect/vitest";
import type { SketchFeatures, SketchStroke } from "@repo/math/sketch";
import { sketchFeatures } from "@repo/math/sketch";
import { Array as Arr, Option } from "effect";

/** The tolerance every case reads with: a quarter of a grid step of 1. */
const TOLERANCE = 0.25;

/** A stroke that follows `f` from `from` to `to`, drawn with `count` points and a hand's wobble. */
function draw(
  f: (x: number) => number,
  from: number,
  to: number,
  count = 161,
  wobble = 0
): SketchStroke {
  return Arr.makeBy(count, (index) => {
    const x = from + ((to - from) * index) / (count - 1);
    return { x, y: f(x) + wobble * Math.sin(40 * x) };
  });
}

/** Expects a number within a small distance of another. */
function expectNear(actual: number, expected: number, within = 0.05) {
  expect(Math.abs(actual - expected)).toBeLessThan(within);
}

/** The directions of the stretches, left to right. */
function directions(features: SketchFeatures) {
  return Arr.map(features.intervals, (interval) => interval.direction);
}

/** The kinds of the zeros, left to right. */
function zeroKinds(features: SketchFeatures) {
  return Arr.map(features.zeros, (zero) => zero.kind);
}

describe("sketch features", () => {
  const parabola = draw((x) => x * x - 1, -2, 2, 161, 0.04);

  it("reads a wobbly parabola's zeros, turn, intercept, stretches and ends", () => {
    const features = sketchFeatures([parabola], TOLERANCE);
    expect(features.isFunction).toBe(true);
    expect(features.branches).toEqual([{ from: -2, to: 2 }]);
    expect(zeroKinds(features)).toEqual(["cross", "cross"]);
    expectNear(Arr.getUnsafe(features.zeros, 0).x, -1);
    expectNear(Arr.getUnsafe(features.zeros, 1).x, 1);
    expect(Arr.map(features.extrema, (turn) => turn.kind)).toEqual(["minimum"]);
    expectNear(Arr.getUnsafe(features.extrema, 0).x, 0, 0.1);
    expectNear(Arr.getUnsafe(features.extrema, 0).y, -1);
    expectNear(
      Option.getOrElse(features.yIntercept, () => 0),
      -1
    );
    expect(directions(features)).toEqual(["falling", "rising"]);
    expect(features.ends.left).toMatchObject({ direction: "falling", x: -2 });
    expect(features.ends.right).toMatchObject({ direction: "rising", x: 2 });
  });

  it("reads a stroke drawn from right to left as the same graph", () => {
    expect(sketchFeatures([Arr.reverse(parabola)], TOLERANCE)).toEqual(
      sketchFeatures([parabola], TOLERANCE)
    );
  });

  it("finds a cubic's maximum and minimum and its three crossings", () => {
    const features = sketchFeatures(
      [draw((x) => x ** 3 - 3 * x, -2.5, 2.5)],
      TOLERANCE
    );
    expect(Arr.map(features.extrema, (turn) => turn.kind)).toEqual([
      "maximum",
      "minimum",
    ]);
    expectNear(Arr.getUnsafe(features.extrema, 0).x, -1);
    expectNear(Arr.getUnsafe(features.extrema, 0).y, 2);
    expectNear(Arr.getUnsafe(features.extrema, 1).x, 1);
    expect(zeroKinds(features)).toEqual(["cross", "cross", "cross"]);
    expectNear(Arr.getUnsafe(features.zeros, 0).x, -Math.sqrt(3));
    expectNear(Arr.getUnsafe(features.zeros, 1).x, 0);
    expectNear(Arr.getUnsafe(features.zeros, 2).x, Math.sqrt(3));
    expect(directions(features)).toEqual(["rising", "falling", "rising"]);
  });

  it("tells a graph that touches the x-axis from one that crosses it", () => {
    const features = sketchFeatures(
      [draw((x) => (x - 1) ** 2, -1, 3)],
      TOLERANCE
    );
    expect(zeroKinds(features)).toEqual(["touch"]);
    expectNear(Arr.getUnsafe(features.zeros, 0).x, 1);
  });

  it("reads a zero at a graph's end and a stretch with no turn", () => {
    const features = sketchFeatures(
      [draw((x) => Math.sqrt(x), 0, 4)],
      TOLERANCE
    );
    expect(features.zeros).toEqual([{ kind: "end", x: 0 }]);
    expect(features.extrema).toEqual([]);
    expect(directions(features)).toEqual(["rising"]);
    expect(features.ends.left.direction).toBe("rising");
  });

  it("reads a falling line above the axis by its ends", () => {
    const features = sketchFeatures([draw((x) => 5 - x, 0, 3)], TOLERANCE);
    expect(features.zeros).toEqual([]);
    expect(directions(features)).toEqual(["falling"]);
    expect(features.ends.right.direction).toBe("falling");
    expectNear(
      Option.getOrElse(features.yIntercept, () => 0),
      5
    );
  });

  it("reads a graph lying along the axis as level", () => {
    const features = sketchFeatures([draw(() => 0.1, 0, 2)], TOLERANCE);
    expect(features.zeros).toEqual([{ kind: "along", x: 0 }]);
    expect(directions(features)).toEqual(["level"]);
    expect(features.yIntercept).toEqual(Option.some(0.1));
  });

  it("finds a steep crossing with no sample inside the band", () => {
    const features = sketchFeatures(
      [draw((x) => 100 * x, -1.03, 1, 2)],
      TOLERANCE
    );
    expect(zeroKinds(features)).toEqual(["cross"]);
    expectNear(Arr.getUnsafe(features.zeros, 0).x, 0, 1e-9);
  });

  it("reads two branches of a hyperbola in order, with no zero and no intercept", () => {
    const right = draw((x) => 1 / x, 0.3, 3);
    const left = draw((x) => 1 / x, -3, -0.3);
    const features = sketchFeatures([right, left], TOLERANCE);
    expect(features.isFunction).toBe(true);
    expect(features.branches).toEqual([
      { from: -3, to: -0.3 },
      { from: 0.3, to: 3 },
    ]);
    expect(features.zeros).toEqual([]);
    expect(features.yIntercept).toEqual(Option.none());
    expect(features.ends.left).toMatchObject({ direction: "falling", x: -3 });
    expect(features.ends.right).toMatchObject({ direction: "falling", x: 3 });
  });

  it("finds that a stroke doubling back is not a function", () => {
    const stroke: SketchStroke = [
      { x: 0, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 3 },
      { x: 1.4, y: 4 },
    ];
    const features = sketchFeatures([stroke], TOLERANCE);
    expect(features.isFunction).toBe(false);
    expect(features.branches).toEqual([{ from: 0, to: 2 }]);
  });

  it("finds that two overlapping strokes are not a function", () => {
    const features = sketchFeatures(
      [draw((x) => x + 5, 0, 2), draw((x) => x + 5, 1, 3)],
      TOLERANCE
    );
    expect(features.isFunction).toBe(false);
  });

  it("reads a single point as one level stretch", () => {
    const features = sketchFeatures([[{ x: 1, y: 3 }]], TOLERANCE);
    expect(features.branches).toEqual([{ from: 1, to: 1 }]);
    expect(features.zeros).toEqual([]);
    expect(directions(features)).toEqual(["level"]);
    expect(features.ends.left).toEqual({ direction: "level", x: 1, y: 3 });
  });
});
