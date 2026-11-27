import { describe, expect, it } from "@effect/vitest";
import {
  barrelMarks,
  eased,
  markLength,
  rimAngle,
  rimMarks,
  straightMarks,
} from "@repo/design-system/components/three/instrument/scale";

describe("instrument scale", () => {
  it("gives every tenth mark the long length and every fifth the middle one", () => {
    expect(markLength(20, [10, 5], [3, 2, 1])).toBe(3);
    expect(markLength(15, [10, 5], [3, 2, 1])).toBe(2);
    expect(markLength(7, [10, 5], [3, 2, 1])).toBe(1);
  });

  it("stands each straight mark exactly on its number and grows it from the edge", () => {
    const up = straightMarks({
      count: 11,
      direction: 1,
      edge: 3,
      every: [10, 5],
      face: 0,
      lengths: [4, 3, 2],
      start: 6,
      step: 1,
      width: 0.1,
    });
    expect(up).toHaveLength(11);
    expect(up[7]?.position[0]).toBeCloseTo(13, 12);
    expect(up[10]?.position[1]).toBeCloseTo(5, 12);
    expect(up[10]?.scale?.[1]).toBe(4);
    const down = straightMarks({
      count: 11,
      direction: -1,
      edge: 3,
      every: [5, 5],
      face: 0,
      lengths: [2, 2, 1],
      start: 0,
      step: 0.9,
      width: 0.1,
    });
    expect(down[10]?.position[0]).toBeCloseTo(9, 12);
    expect(down[1]?.position[1]).toBeCloseTo(2.5, 12);
  });

  it("wraps barrel marks from the datum line to either side", () => {
    const above = barrelMarks({
      count: 26,
      every: [5, 5],
      lengths: [2, 2, 1.5],
      radius: 6,
      side: 1,
      start: 42,
      step: 1,
      width: 0.1,
    });
    const below = barrelMarks({
      count: 25,
      every: [5, 5],
      lengths: [1, 1, 1],
      radius: 6,
      side: -1,
      start: 42.5,
      step: 1,
      width: 0.1,
    });
    expect(above[25]?.position[0]).toBeCloseTo(67, 12);
    expect(above[1]?.position[1]).toBeGreaterThan(0);
    expect(below[0]?.position[0]).toBeCloseTo(42.5, 12);
    expect(below[0]?.position[1]).toBeLessThan(0);
  });

  it("puts rim division zero on the datum line and raises the numbers toward +y", () => {
    expect(rimAngle(0, 50)).toBeCloseTo(Math.PI / 2, 12);
    expect(rimAngle(5, 50)).toBeLessThan(rimAngle(0, 50));
    const marks = rimMarks({
      count: 50,
      every: [5, 5],
      lengths: [3, 3, 2],
      radius: 6,
      slope: 0.5,
      width: 0.1,
    });
    expect(marks).toHaveLength(50);
    expect(marks[0]?.position[1]).toBeCloseTo(0, 12);
    expect(marks[0]?.position[2]).toBeGreaterThan(6);
    expect(marks[0]?.rotation?.[1]).toBe(-0.5);
  });

  it("eases toward a target and lands on it", () => {
    expect(eased(0, 10, 5, 0.1)).toBeCloseTo(5, 12);
    expect(eased(0, 10, 5, 1)).toBe(10);
    expect(eased(9.999_99, 10, 1, 0.01)).toBe(10);
  });
});
