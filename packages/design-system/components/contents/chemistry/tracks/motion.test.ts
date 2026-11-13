import { describe, expect, it } from "@effect/vitest";
import {
  getParticle,
  trackPoints,
  trackRadius,
} from "@repo/design-system/components/contents/chemistry/tracks/motion";
import { Array as Arr } from "effect";

describe("particle tracks", () => {
  it("curls an electron 1836 times tighter than a proton at the same speed", () => {
    expect(
      trackRadius("proton", 0.05) / trackRadius("electron", 0.05)
    ).toBeCloseTo(1836.15, 1);
    expect(trackRadius("electron", 0.01)).toBeCloseTo(5.686e-4, 6);
    expect(trackRadius("neutron", 1)).toBe(Number.POSITIVE_INFINITY);
    expect(getParticle("neutron").charge).toBe(0);
  });

  it("bends positive and negative particles to opposite sides", () => {
    const proton = trackPoints("proton", 0.05, 0.2, 0.3, 50);
    const electron = trackPoints("electron", 1e-4, 0.05, 0.3, 50);

    expect(Arr.getUnsafe(proton, 50)[1]).toBeGreaterThan(0);
    expect(Arr.getUnsafe(electron, 50)[1]).toBeLessThan(0);
  });

  it("flies a neutron straight and stops a track at the edge", () => {
    const neutron = trackPoints("neutron", 0.05, 1, 0.1, 10);

    expect(Arr.every(neutron, ([, y]) => y === 0)).toBe(true);
    expect(neutron).toHaveLength(2);
  });
});
