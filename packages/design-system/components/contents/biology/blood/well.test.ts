// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  BOWL,
  CAVITY,
  capVolume,
  columnX,
  DROP,
  filmShade,
  floorAt,
  gatherAt,
  grainsOf,
  poolDepth,
  poolRadius,
  ROWS,
  rowOf,
  rowZ,
  TILE,
} from "@repo/design-system/components/contents/biology/blood/well";
import { Array as Arr } from "effect";

describe("a cavity of the grouping tile", () => {
  it("sets anti-A, anti-B and anti-D left to right and the rows back to front, each cavity inside the tile", () => {
    expect([columnX(0), columnX(1), columnX(2)]).toEqual([-0.03, 0, 0.03]);
    expect(rowZ(0)).toBeCloseTo(-0.045, 12);
    expect(rowZ(ROWS - 1)).toBeCloseTo(0.045, 12);
    expect(columnX(2) + CAVITY.radius).toBeLessThan(TILE.width / 2);
    expect(rowZ(ROWS - 1) + CAVITY.radius).toBeLessThan(TILE.length / 2);
  });

  it("fills the rows nearest the reader and leaves the back rows empty", () => {
    expect([rowOf(0, 3), rowOf(2, 3)]).toEqual([1, 3]);
    expect([rowOf(0, 4), rowOf(3, 4)]).toEqual([0, 3]);
    expect(rowOf(0, 1)).toBe(3);
  });

  it("cuts a 21 mm cavity 2 mm deep from a sphere of about 28.6 mm radius", () => {
    expect(BOWL * 1000).toBeCloseTo(28.5625, 9);
    expect(floorAt(0)).toBeCloseTo(CAVITY.depth, 12);
    expect(floorAt(CAVITY.radius)).toBeCloseTo(0, 12);
    expect(floorAt(1)).toBeCloseTo(0, 12);
  });

  it("holds about 0.35 mL to its rim", () => {
    expect(capVolume(CAVITY.depth) * 1e6).toBeCloseTo(0.3506, 3);
  });

  it("pools a drop of serum and a drop of blood about 15 mm across, as the slide method spreads them", () => {
    const depth = poolDepth(2 * DROP);
    expect(capVolume(depth)).toBeCloseTo(2 * DROP, 14);
    expect(depth * 1000).toBeCloseTo(1.062, 3);
    expect(2 * poolRadius(depth) * 1000).toBeCloseTo(15.4, 1);
    expect(poolRadius(CAVITY.depth)).toBeCloseTo(CAVITY.radius, 12);
  });

  it("fills to the rim and no further", () => {
    expect(poolDepth(1e-6)).toBe(CAVITY.depth);
  });

  it("shows a film paler at its thin rim than in its deep middle", () => {
    expect(filmShade(0)).toBe(1);
    expect(filmShade(0.001)).toBeCloseTo(0.62 + 0.38 * Math.exp(-4), 12);
    expect(filmShade(0.01)).toBeCloseTo(0.62, 12);
  });

  it("lays the same clumps out for the same well, inside the pool", () => {
    const pool = poolRadius(poolDepth(2 * DROP));
    const grains = grainsOf(3, pool);
    expect(grainsOf(3, pool)).toEqual(grains);
    expect(grainsOf(4, pool)).not.toEqual(grains);
    expect(grains).toHaveLength(10 * 8 + 40);
    for (const grain of grains) {
      expect(Math.hypot(...grain.to) + grain.radius).toBeLessThan(pool);
      expect(Math.hypot(...grain.from)).toBeLessThan(pool);
      expect(grain.join).toBeGreaterThan(0);
      expect(grain.join).toBeLessThan(1);
    }
  });

  it("gathers each grain after the reaction passes its share, and every grain by the end", () => {
    expect(gatherAt(0.1, 0.5)).toBe(0);
    expect(gatherAt(0.55, 0.5)).toBeCloseTo(0.5, 12);
    expect(gatherAt(1, 0.75)).toBe(1);
  });

  it("gathers each clump from grains that start scattered", () => {
    const grains = grainsOf(1, 0.0076);
    const moved = Arr.filter(
      grains,
      (grain) =>
        Math.hypot(grain.to[0] - grain.from[0], grain.to[1] - grain.from[1]) >
        0.001
    );
    expect(moved.length).toBeGreaterThan(10 * 8 * 0.6);
  });
});
