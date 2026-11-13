import { describe, expect, it } from "@effect/vitest";
import {
  alphaPath,
  alphaSpeed,
  cumulativeLengths,
  pointAlong,
  closestApproach,
  deflection,
  GOLD_CHARGE,
  GOLD_NUCLEUS,
} from "@repo/design-system/components/contents/chemistry/scattering/coulomb";
import { Array as Arr } from "effect";

describe("Rutherford scattering", () => {
  it("stops a 5 MeV alpha about 45 fm from a gold nucleus", () => {
    expect(closestApproach(5, GOLD_CHARGE)).toBeCloseTo(45.504, 3);
    expect(GOLD_NUCLEUS).toBeCloseTo(6.98, 2);
  });

  it("turns an alpha right round head-on and a quarter turn at b = d / 2", () => {
    const approach = closestApproach(5, GOLD_CHARGE);

    expect(deflection(0, approach)).toBeCloseTo(Math.PI, 12);
    expect(deflection(approach / 2, approach)).toBeCloseTo(Math.PI / 2, 12);
    expect(deflection(-approach / 2, approach)).toBeCloseTo(Math.PI / 2, 12);
    expect(deflection(100 * approach, approach)).toBeLessThan(0.01);
  });

  it("sends a near miss out along its deflected direction", () => {
    const approach = closestApproach(5, GOLD_CHARGE);
    const path = alphaPath(approach / 2, approach, 4000, 4000);
    const [x, y] = Arr.getUnsafe(path, path.length - 1);
    const [px, py] = Arr.getUnsafe(path, path.length - 2);

    expect(Math.atan2(y - py, x - px)).toBeCloseTo(Math.PI / 2, 1);
    expect(Arr.getUnsafe(path, 0)).toEqual([-4000, approach / 2]);
    for (const [pointX, pointY] of path) {
      expect(Math.abs(pointX)).toBeLessThanOrEqual(4000);
      expect(Math.abs(pointY)).toBeLessThanOrEqual(4000);
      expect(Math.hypot(pointX, pointY)).toBeGreaterThan(approach / 2);
    }
  });

  it("mirrors a path that passes below the nucleus", () => {
    const approach = closestApproach(5, GOLD_CHARGE);
    const above = alphaPath(30, approach, 300, 400);
    const below = alphaPath(-30, approach, 300, 400);

    expect(Arr.map(below, ([x, y]) => [x, -y])).toEqual(above);
  });

  it("sends a head-on alpha back the way it came", () => {
    expect(alphaPath(0, 45, 300, 400)).toEqual([
      [-300, 0],
      [-45, 0],
      [-300, 0],
    ]);
  });

  it("walks a path by distance and keeps to its ends", () => {
    const path = [
      [0, 0],
      [3, 4],
      [3, 10],
    ] as const;
    const lengths = cumulativeLengths(path);

    expect(lengths).toEqual([0, 5, 11]);
    expect(pointAlong(path, lengths, 0)).toEqual([0, 0]);
    expect(pointAlong(path, lengths, 2.5)).toEqual([1.5, 2]);
    expect(pointAlong(path, lengths, 8)).toEqual([3, 7]);
    expect(pointAlong(path, lengths, 20)).toEqual([3, 10]);
  });

  it("slows an alpha as it climbs toward the nucleus", () => {
    expect(alphaSpeed(4000, 45)).toBeCloseTo(Math.sqrt(1 - 45 / 4000), 12);
    expect(alphaSpeed(45, 45)).toBe(0.2);
    expect(alphaSpeed(10, 45)).toBe(0.2);
  });
});
