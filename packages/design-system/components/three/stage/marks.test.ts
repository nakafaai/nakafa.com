import { describe, expect, it } from "@effect/vitest";
import {
  paintDashes,
  paintLine,
  paintVerge,
  paintWorn,
} from "@repo/design-system/components/three/stage/marks";
import { Array as Arr } from "effect";

describe("paintDashes", () => {
  it("is white along the dash and black after it", () => {
    const row = paintDashes(8, 0.5);
    expect(Arr.makeBy(8, (pixel) => row[pixel * 4 + 1])).toEqual([
      255, 255, 255, 255, 0, 0, 0, 0,
    ]);
  });
});

describe("paintVerge", () => {
  it("is black at both ends and white across the middle", () => {
    const row = paintVerge(9, 0.25);
    const alpha = Arr.makeBy(9, (pixel) => row[pixel * 4 + 1] ?? 0);
    expect(alpha[0]).toBe(0);
    expect(alpha[8]).toBe(0);
    expect(alpha[4]).toBe(255);
    expect(alpha[1]).toBeGreaterThan(0);
    expect(alpha[1]).toBeLessThan(255);
  });
});

describe("paintLine", () => {
  /** How much of the paint shows in one column of the image, from 0 to 1. */
  function shown(image: Uint8ClampedArray, width: number, column: number) {
    const rows = image.length / 4 / width;
    return (
      Arr.reduce(
        Arr.makeBy(rows, (row) => Number(image[(row * width + column) * 4])),
        0,
        (sum, value) => sum + value
      ) /
      rows /
      255
    );
  }

  it("paints a dash and leaves the road bare after it", () => {
    const image = paintLine(64, 8, 0.5);
    const painted = Arr.makeBy(64, (column) => shown(image, 64, column));

    expect(image).toHaveLength(64 * 8 * 4);
    expect(Math.max(...Arr.take(painted, 32))).toBeGreaterThan(0.5);
    expect(Math.max(...Arr.drop(painted, 33))).toBe(0);
    expect(painted[0]).toBe(0);
  });

  it("wears a solid line along its edges and in flakes, never at an end", () => {
    const image = paintLine(64, 8, 1);
    const painted = Arr.makeBy(64, (column) => shown(image, 64, column));
    const whole = Arr.reduce(painted, 0, (sum, value) => sum + value) / 64;

    expect(whole).toBeGreaterThan(0.3);
    expect(whole).toBeLessThan(0.95);
    expect(Number(image[0])).toBeLessThan(Number(image[(4 * 64 + 20) * 4]) + 1);
    expect(image).toEqual(paintLine(64, 8, 1));
  });
});

describe("paintWorn", () => {
  it("is strongest along the middle of the path and gone at its sides", () => {
    const size = 16;
    const image = paintWorn(size);
    const row = (at: number) =>
      Arr.makeBy(size, (column) => Number(image[(at * size + column) * 4]));

    expect(Math.max(...row(0))).toBeLessThan(10);
    expect(Math.max(...row(size - 1))).toBeLessThan(10);
    expect(Math.min(...row(size / 2))).toBeGreaterThan(60);
    expect(
      Math.max(...row(size / 2)) - Math.min(...row(size / 2))
    ).toBeGreaterThan(10);
  });
});
