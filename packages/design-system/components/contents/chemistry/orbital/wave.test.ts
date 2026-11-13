import { describe, expect, it } from "@effect/vitest";
import {
  halton,
  orbitalNumbers,
  orbitalReach,
  radialNodes,
  sampleCloud,
  waveAt,
} from "@repo/design-system/components/contents/chemistry/orbital/wave";
import { Array as Arr } from "effect";

describe("orbital wave functions", () => {
  it("counts the radial nodes of each orbital as n - l - 1", () => {
    expect(radialNodes("1s")).toBe(0);
    expect(radialNodes("2s")).toBe(1);
    expect(radialNodes("3s")).toBe(2);
    expect(radialNodes("3pz")).toBe(1);
    expect(radialNodes("3dz2")).toBe(0);
    expect(orbitalNumbers("3dxy")).toEqual({ l: 2, n: 3, tex: "3d_{xy}" });
  });

  it("vanishes on the radial node spheres of 2s and 3s", () => {
    expect(waveAt("2s", 2, 0, 0)).toBeCloseTo(0, 12);
    expect(waveAt("3s", (9 - 3 * Math.sqrt(3)) / 2, 0, 0)).toBeCloseTo(0, 12);
    expect(waveAt("3pz", 0, 0, 6)).toBeCloseTo(0, 12);
  });

  it("gives p and d lobes opposite signs and nodal planes", () => {
    expect(waveAt("2pz", 0, 0, 1)).toBeGreaterThan(0);
    expect(waveAt("2pz", 0, 0, -1)).toBeLessThan(0);
    expect(waveAt("2px", 0, 1, 0)).toBeCloseTo(0, 12);
    expect(waveAt("3dxy", 1, -1, 0)).toBeLessThan(0);
    expect(waveAt("3dz2", 0, 0, 1)).toBeGreaterThan(0);
    expect(waveAt("3dz2", 1, 0, 0)).toBeLessThan(0);
  });

  it("is finite at the nucleus: whole for s, zero for the others", () => {
    expect(waveAt("1s", 0, 0, 0)).toBe(1);
    expect(waveAt("2pz", 0, 0, 0)).toBe(0);
  });

  it("spreads Halton points evenly through the unit interval", () => {
    expect(Arr.map([1, 2, 3, 4], (index) => halton(index, 2))).toEqual([
      0.5, 0.25, 0.75, 0.125,
    ]);
  });

  it("crowds a 1s cloud near the nucleus and gives 2pz two signs", () => {
    const cloud = sampleCloud("1s", 4000);
    const near = Arr.filter(cloud, (point) => {
      const [x, y, z] = point.position;
      return Math.sqrt(x * x + y * y + z * z) < 1.5;
    });
    expect(near.length / cloud.length).toBeGreaterThan(0.5);
    expect(orbitalReach("1s")).toBe(3);

    const lobes = sampleCloud("2pz", 4000);
    expect(Arr.some(lobes, (point) => point.phase === -1)).toBe(true);
    expect(Arr.some(lobes, (point) => point.phase === 1)).toBe(true);
  });
});
