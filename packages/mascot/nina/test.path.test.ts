import { describe, expect, it } from "@effect/vitest";
import { outlineOf } from "@repo/mascot/nina/test.path";
import { Array as Arr, Option, Order } from "effect";

/** The heights of the places along a path. */
function heightsOf(d: string) {
  return Arr.map(outlineOf(d), ([, y]) => y);
}

/** The lowest height a path reaches: the top of what it draws. */
function topOf(d: string) {
  return Arr.reduce(
    heightsOf(d),
    Number.POSITIVE_INFINITY,
    Order.min(Order.Number)
  );
}

/** The greatest height a path reaches: the bottom of what it draws. */
function bottomOf(d: string) {
  return Arr.reduce(
    heightsOf(d),
    Number.NEGATIVE_INFINITY,
    Order.max(Order.Number)
  );
}

describe("the places along a path", () => {
  it("are the places it draws, in order: its moves and lines, then twelve along each curve, and the start again where it closes", () => {
    expect(outlineOf("M0,0 L10,0 H20 V5 Z")).toEqual([
      [0, 0],
      [10, 0],
      [20, 0],
      [20, 5],
      [0, 0],
    ]);
    const curve = outlineOf("M0,0 Q10,0 10,10");
    expect(curve).toHaveLength(13);
    expect(curve[0]).toEqual([0, 0]);
    expect(curve[12]).toEqual([10, 10]);
    expect(curve[6][0]).toBeCloseTo(7.5, 9);
    expect(curve[6][1]).toBeCloseTo(2.5, 9);
  });

  it("count a lower-case command from where the pen is, and read more numbers as the same command again", () => {
    expect(outlineOf("m5,5 l10,0 h5 v5 l-5,0 -5,0 z")).toEqual([
      [5, 5],
      [15, 5],
      [20, 5],
      [20, 10],
      [15, 10],
      [10, 10],
      [5, 5],
    ]);
    expect(outlineOf("M0,0 10,0 10,10")).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
    ]);
  });

  it("mirror the last control place for a smooth curve", () => {
    expect(Arr.last(outlineOf("M0,0 Q10,10 20,0 T40,0"))).toEqual(
      Option.some([40, 0])
    );
    expect(topOf("M0,0 Q10,10 20,0 T40,0")).toBeCloseTo(-5, 9);
    expect(topOf("M0,0 C0,10 10,10 10,0 S20,-10 20,0")).toBeCloseTo(-7.5, 9);
  });

  it("take the pen itself as the mirrored control place when no curve of that kind comes before", () => {
    expect(Arr.every(heightsOf("M0,0 L10,0 T20,0"), (y) => y === 0)).toBe(true);
    // The first thirteen places are the move and the quadratic curve before the smooth cubic one.
    const smooth = Arr.drop(heightsOf("M0,0 Q10,10 20,0 S30,0 40,0"), 13);
    expect(Arr.every(smooth, (y) => y === 0)).toBe(true);
  });

  it("go round an arc by its centre, on the side its flags pick", () => {
    expect(bottomOf("M0,0 A10,10 0 0,0 20,0")).toBeCloseTo(10, 9);
    expect(topOf("M0,0 A10,10 0 0,1 20,0")).toBeCloseTo(-10, 9);
    const ring = "M0,0 m-5,0 a5,5 0 1,0 10,0 a5,5 0 1,0 -10,0";
    expect(bottomOf(ring)).toBeCloseTo(5, 9);
    expect(topOf(ring)).toBeCloseTo(-5, 9);
  });

  it("draw an arc without a radius as a straight line", () => {
    expect(outlineOf("M0,0 A0,5 0 0,1 10,0")).toEqual([
      [0, 0],
      [10, 0],
    ]);
  });
});
