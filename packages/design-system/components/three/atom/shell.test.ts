import { describe, expect, it } from "@effect/vitest";
import {
  electronsInto,
  electronsOf,
  fadesOf,
  orbitsOf,
  TRAIL,
} from "@repo/design-system/components/three/atom/shell";
import { Array as Arr } from "effect";

describe("orbitsOf", () => {
  it("draws an even ladder of shells that turn more slowly outward", () => {
    const orbits = orbitsOf([2, 8, 1.9, -4], 1, 0.5);
    expect(Arr.map(orbits, (orbit) => orbit.radius)).toEqual([1, 1.5, 2, 2.5]);
    expect(Arr.map(orbits, (orbit) => orbit.electrons)).toEqual([2, 8, 1, 0]);
    expect(orbits[0]?.pace).toBeGreaterThan(Number(orbits[1]?.pace));
    expect(orbits[1]?.pace).toBeGreaterThan(Number(orbits[2]?.pace));
    expect(electronsOf(orbits)).toBe(11);
  });
});

describe("electronsInto", () => {
  it("keeps every electron and its trail on its own orbit, evenly spaced", () => {
    const orbits = orbitsOf([2, 3], 1, 1);
    const places = new Float32Array(electronsOf(orbits) * TRAIL * 3);
    electronsInto(places, orbits, 2);
    for (let point = 0; point < places.length / 3; point += 1) {
      const radius = Math.hypot(
        Number(places[point * 3]),
        Number(places[point * 3 + 2])
      );
      expect(radius).toBeCloseTo(point < 2 * TRAIL ? 1 : 2, 5);
      expect(places[point * 3 + 1]).toBe(0);
    }
    expect(Number(places[0]) + Number(places[TRAIL * 3])).toBeCloseTo(0, 5);
  });

  it("moves the electrons on as time passes and trails them behind", () => {
    const orbits = orbitsOf([1], 1, 1);
    const early = new Float32Array(TRAIL * 3);
    const late = new Float32Array(TRAIL * 3);
    electronsInto(early, orbits, 0);
    electronsInto(late, orbits, 0.045);
    expect(early[0]).toBeCloseTo(Math.cos(0.4), 6);
    expect(late[3]).toBeCloseTo(Number(early[0]), 6);
    expect(late[5]).toBeCloseTo(Number(early[2]), 6);
    expect(Number(late[2])).toBeLessThan(0);
  });
});

describe("fadesOf", () => {
  it("is full on each electron and fades along its trail", () => {
    const fades = fadesOf(orbitsOf([2], 1, 1));
    expect(fades).toHaveLength(2 * TRAIL);
    expect(fades[0]).toBe(1);
    expect(fades[TRAIL]).toBe(1);
    expect(Number(fades[1])).toBeLessThan(1);
    expect(Number(fades[TRAIL - 1])).toBeLessThan(Number(fades[1]));
    expect(Number(fades[TRAIL - 1])).toBeGreaterThan(0);
  });
});
