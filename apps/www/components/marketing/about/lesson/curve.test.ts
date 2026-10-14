// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import {
  bondEnds,
  fitBox,
  GRAVITY,
  pathData,
  projectilePath,
  quadratic,
  quadraticPath,
} from "@/components/marketing/about/lesson/curve";

describe("lesson curves", () => {
  it("lands a projectile at the range that its speed and angle give", () => {
    const radians = (60 * Math.PI) / 180;
    const flight = (2 * 40 * Math.sin(radians)) / GRAVITY;
    const range = 40 * Math.cos(radians) * flight;
    const path = projectilePath(40, 60);
    const last = Arr.getUnsafe(path, path.length - 1);

    expect(Arr.getUnsafe(path, 0)).toEqual({ x: 0, y: 0 });
    expect(last.x).toBeCloseTo(range, 6);
    expect(last.y).toBeCloseTo(0, 6);
  });

  it("peaks where the vertical speed says it does", () => {
    const path = projectilePath(40, 60);
    const apex = Arr.reduce(path, 0, (highest, point) =>
      Math.max(highest, point.y)
    );

    // The apex is v sin(angle) squared over 2g: 40 sin 60 squared over 20.
    expect(apex).toBeCloseTo((40 * 40 * 3) / 4 / (2 * GRAVITY), 6);
  });

  it("fits the window of a flight to its range and apex", () => {
    const path = projectilePath(40, 60);
    const box = fitBox(path, 300, 150);
    const last = Arr.getUnsafe(path, path.length - 1);

    expect(box).toMatchObject({ height: 150, minX: 0, minY: 0, width: 300 });
    expect(box.maxX).toBeCloseTo(last.x, 9);
    expect(box.maxY).toBeCloseTo(60, 6);
  });

  it("crosses the horizontal axis at the roots of x squared minus four x plus three", () => {
    expect(quadratic(1)).toBe(0);
    expect(quadratic(3)).toBe(0);
    expect(quadratic(2)).toBe(-1);
  });

  it("samples the quadratic across the whole requested interval", () => {
    const path = quadraticPath(-0.5, 4.5);

    expect(Arr.getUnsafe(path, 0).x).toBeCloseTo(-0.5, 6);
    expect(Arr.getUnsafe(path, path.length - 1).x).toBeCloseTo(4.5, 6);
  });

  it("opens the bonds of a bent molecule at the angle its chemistry gives", () => {
    const length = 10;
    const [left, right] = bondEnds(104.5, length);
    const dot = left.x * right.x + left.y * right.y;

    // Both bonds have the same length, so the cosine of the angle is their dot product over the square of it.
    expect(dot / (length * length)).toBeCloseTo(
      Math.cos((104.5 * Math.PI) / 180),
      9
    );
    expect(left.x).toBeLessThan(0);
    expect(right.x).toBeGreaterThan(0);
    expect(left.y).toBeCloseTo(right.y, 9);
  });

  it("fits a curve into its picture with the vertical axis pointing up", () => {
    const box = {
      height: 50,
      maxX: 10,
      maxY: 10,
      minX: 0,
      minY: 0,
      width: 100,
    };

    expect(
      pathData(
        [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        box
      )
    ).toBe("M0.00 50.00 L100.00 0.00");
  });
});
