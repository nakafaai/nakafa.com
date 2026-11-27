import { describe, expect, it } from "@effect/vitest";
import {
  hexagonRadius,
  stationsBetween,
  threadRadius,
  turnedSurface,
} from "@repo/design-system/components/three/instrument/turn";

describe("turned surface", () => {
  it("stands every vertex at its radius from the axis and closes each ring", () => {
    const surface = turnedSurface([0, 2], 4, (along) => along + 1);

    expect(surface.positions).toHaveLength(2 * 5 * 3);
    expect(surface.faces).toHaveLength(4 * 6);
    expect(Array.from(surface.positions.slice(0, 3))).toEqual([0, 1, 0]);
    expect(surface.positions[15]).toBe(2);
    expect(surface.positions[16]).toBeCloseTo(3);
    expect(surface.positions[5]).toBeCloseTo(1);
    expect(Array.from(surface.faces.slice(0, 6))).toEqual([0, 5, 1, 1, 5, 6]);
    expect(surface.coordinates[9]).toBe(0);
    expect(surface.coordinates[8]).toBe(1);
  });

  it("has no faces without two rings", () => {
    expect(turnedSurface([], 4, () => 1).faces).toHaveLength(0);
  });

  it("spaces stations no farther apart than asked, ends included", () => {
    expect(stationsBetween(0, 1, 0.5)).toEqual([0, 0.5, 1]);
    expect(stationsBetween(2, 2, 0.5)).toEqual([2, 2]);
  });

  it("gives a hexagon its corners and its flats", () => {
    expect(hexagonRadius(8, 0)).toBeCloseTo(8 / Math.cos(Math.PI / 6));
    expect(hexagonRadius(8, Math.PI / 6)).toBeCloseTo(8);
    expect(hexagonRadius(8, -Math.PI / 6)).toBeCloseTo(8);
    expect(hexagonRadius(8, Math.PI)).toBeCloseTo(8 / Math.cos(Math.PI / 6));
  });

  it("winds a thread one pitch every turn between crest and root", () => {
    const thread = { crest: 5, depth: 0.9, pitch: 1.5 };

    expect(threadRadius(thread, 0.75, 0)).toBeCloseTo(4.1);
    expect(threadRadius(thread, 0, 0)).toBeCloseTo(5);
    expect(threadRadius(thread, 1.5, 0)).toBeCloseTo(5);
    expect(threadRadius(thread, 0.75, Math.PI)).toBeCloseTo(5);
  });
});
