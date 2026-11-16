// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  cytoplasmPoints,
  flagellumPath,
  insideRod,
  nucleoidPath,
  rodProfile,
  rodSurfaceSpots,
  surfaceBump,
} from "@repo/design-system/components/contents/biology/bacteria/cell";
import { Array as Arr, Option } from "effect";

describe("bacterial cell geometry", () => {
  it("outlines a rod from one pole tip to the other", () => {
    const profile = rodProfile(0.4, 1.2, 8);
    const [tip] = profile;
    const end = Option.getOrThrow(Arr.last(profile));

    expect(tip?.[0]).toBeCloseTo(0, 12);
    expect(tip?.[1]).toBeCloseTo(1, 12);
    expect(end[1]).toBeCloseTo(-1, 12);
    expect(Arr.every(profile, ([r]) => r <= 0.4 + 1e-12)).toBe(true);
  });

  it("bumps the surface by a few hundredths of the radius", () => {
    const bumps = Arr.map(Arr.range(0, 50), (step) =>
      surfaceBump(step * 0.3, step * 0.05, 2)
    );

    expect(Arr.every(bumps, (bump) => Math.abs(bump) < 0.05)).toBe(true);
    expect(Arr.dedupe(bumps).length).toBeGreaterThan(10);
  });

  it("winds a left-handed flagellum that opens from the hook", () => {
    const path = flagellumPath({
      length: 6,
      phase: 0,
      pitch: 2.4,
      radius: 0.22,
      samples: 240,
    });
    const [hook] = path;
    const [, a, b] = path;

    expect(hook).toEqual([0, 0, 0]);
    expect(path).toHaveLength(241);
    // Left-handed: going along +x, the point turns clockwise seen from +x.
    expect(a?.[2] ?? 0).toBeLessThanOrEqual(0);
    expect((b?.[2] ?? 0) - (a?.[2] ?? 0)).toBeLessThan(0);
    const far = path[240];
    expect(Math.hypot(far?.[1] ?? 0, far?.[2] ?? 0)).toBeCloseTo(0.22, 12);
  });

  it("spreads appendages over the surface with outward normals", () => {
    const spots = rodSurfaceSpots(60, 0.4, 1.2);

    expect(spots).toHaveLength(60);
    expect(
      Arr.every(
        spots,
        ({ normal }) => Math.abs(Math.hypot(...normal) - 1) < 1e-9
      )
    ).toBe(true);
  });

  it("keeps ribosomes and the nucleoid inside the cell", () => {
    const ribosomes = cytoplasmPoints(200, 0.4, 1.2, 5);

    expect(ribosomes.length).toBeGreaterThan(100);
    expect(Arr.every(ribosomes, (point) => insideRod(point, 0.4, 1.2))).toBe(
      true
    );
    expect(insideRod([1.2, 0, 0], 0.4, 1.2)).toBe(false);
    const nucleoid = nucleoidPath(300, 0.16, 0.8, 3);
    expect(nucleoid).toHaveLength(301);
    expect(Arr.every(nucleoid, (point) => insideRod(point, 0.4, 1.2))).toBe(
      true
    );
  });
});
