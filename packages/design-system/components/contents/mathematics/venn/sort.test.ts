// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  carried,
  carryAt,
  ease,
  SORT,
  settled,
  sortEnd,
} from "@repo/design-system/components/contents/mathematics/venn/sort";

describe("the sorting run", () => {
  it("sends the objects one after another and ends when the last has settled", () => {
    expect(carried(0, 0)).toBe(0);
    expect(carried(SORT.start + SORT.carry, 0)).toBe(1);
    expect(carried(SORT.start + SORT.carry, 3)).toBeLessThan(1);
    expect(settled(sortEnd(4), 3)).toBe(1);
    expect(settled(sortEnd(4) - SORT.settle, 3)).toBe(0);
    expect(sortEnd(0)).toBe(sortEnd(1));
  });

  it("eases a move at both ends", () => {
    expect(ease(0)).toBe(0);
    expect(ease(0.5)).toBe(0.5);
    expect(ease(1)).toBe(1);
  });

  it("lifts an object in an arc from the tray's height to the mat's", () => {
    const from = { x: 0, y: 0.01, z: 0.9 };
    const to = { x: 0.3, y: 0.006, z: -0.2 };
    expect(carryAt(from, to, 0)).toEqual(from);
    const end = carryAt(from, to, 1);
    expect(end.x).toBeCloseTo(to.x);
    expect(end.y).toBeCloseTo(to.y);
    expect(end.z).toBeCloseTo(to.z);
    expect(carryAt(from, to, 0.5).y).toBeCloseTo(0.008 + SORT.lift);
  });
});
