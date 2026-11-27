import { describe, expect, it } from "@effect/vitest";
import {
  homesOf,
  WATER,
  wanderInto,
} from "@repo/design-system/components/three/molecule/water";
import { Array as Arr } from "effect";

describe("WATER", () => {
  it("has water's bond length and angle", () => {
    const [, first, second] = WATER;
    expect(Math.hypot(first[1], first[2])).toBeCloseTo(0.9572, 3);
    const cosine = (first[1] * second[1] + first[2] * second[2]) / 0.9572 ** 2;
    expect((Math.acos(cosine) * 180) / Math.PI).toBeCloseTo(104.52, 1);
  });
});

describe("homesOf", () => {
  it("scatters every molecule inside the shell, the same each time", () => {
    const homes = homesOf(40, 10, 20);
    const reaches = Arr.map(Arr.range(0, 39), (index) =>
      Math.hypot(
        Number(homes[index * 3]),
        Number(homes[index * 3 + 1]),
        Number(homes[index * 3 + 2])
      )
    );
    expect(Math.min(...reaches)).toBeGreaterThanOrEqual(10);
    expect(Math.max(...reaches)).toBeLessThanOrEqual(20);
    expect(homesOf(40, 10, 20)).toEqual(homes);
  });
});

describe("wanderInto", () => {
  it("drifts each molecule near its home without straying past the stride", () => {
    const homes = homesOf(12, 4, 8);
    const early = new Float32Array(homes.length);
    const late = new Float32Array(homes.length);
    wanderInto(early, homes, 0, 0.5);
    wanderInto(late, homes, 6, 0.5);
    expect(late).not.toEqual(early);
    const strays = Arr.map(Arr.range(0, homes.length - 1), (slot) =>
      Math.abs(Number(late[slot]) - Number(homes[slot]))
    );
    expect(Math.max(...strays)).toBeLessThanOrEqual(0.5);
    expect(Math.max(...strays)).toBeGreaterThan(0.05);
  });
});
