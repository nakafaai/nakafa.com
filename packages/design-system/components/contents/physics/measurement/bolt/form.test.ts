import { describe, expect, it } from "@effect/vitest";
import {
  HEAD_REACH,
  HEAD_STATIONS,
  headRadius,
  SHANK_STATIONS,
  shankRadius,
} from "@repo/design-system/components/contents/physics/measurement/bolt/form";
import { Array as Arr, Option } from "effect";

describe("bolt form", () => {
  it("closes the head at both faces and rings it in order", () => {
    expect(headRadius(-6.4, 0)).toBe(0);
    expect(headRadius(0, 0)).toBe(0);
    expect(HEAD_STATIONS[0]).toBe(-6.4);
  });

  it("gives the head a flat down, its chamfer on top and its washer face below", () => {
    expect(headRadius(-3, Math.PI)).toBeCloseTo(HEAD_REACH.flats);
    expect(headRadius(-3, Math.PI / 2)).toBeCloseTo(HEAD_REACH.corners);
    expect(headRadius(-6.3, Math.PI / 2)).toBeCloseTo(7.5 + 0.1 * Math.sqrt(3));
    expect(headRadius(-0.2, Math.PI / 2)).toBeCloseTo(7.4);
  });

  it("keeps the shank plain, then winds the thread in and chamfers the tip", () => {
    expect(shankRadius(0, 0)).toBe(0);
    expect(shankRadius(50, 0)).toBe(0);
    expect(shankRadius(10, 1)).toBe(5);
    expect(shankRadius(22.6, 0)).toBeGreaterThan(4.9);
    expect(shankRadius(30.75, 0)).toBeCloseTo(5 - 0.92);
    expect(shankRadius(30, 0)).toBeCloseTo(5);
    expect(shankRadius(49.5, 0)).toBeLessThanOrEqual(4.3);
    expect(Arr.last(SHANK_STATIONS)).toEqual(Option.some(50));
  });
});
