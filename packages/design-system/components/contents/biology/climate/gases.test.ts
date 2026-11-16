// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { moleculeParts } from "@repo/design-system/components/contents/biology/climate/gases";
import { EARTH_RADIUS } from "@repo/design-system/components/contents/biology/climate/rays";
import { Array as Arr, Order } from "effect";

const distance = (
  a: readonly [number, number, number],
  b: readonly [number, number, number]
) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const atoms = (level: number) => {
  const parts = moleculeParts(level);
  return Arr.flatMap([parts.carbon, parts.hydrogen, parts.oxygen], (part) =>
    Arr.map(part.balls, (ball) => ({
      position: ball.position,
      radius: ball.scale[0],
    }))
  );
};

describe("the molecules of the atmosphere", () => {
  it("grow in number with the gas level", () => {
    const counts = Arr.map([1, 3, 5], (level) => atoms(level).length);
    expect(counts[0]).toBeLessThan(counts[1] ?? 0);
    expect(counts[1]).toBeLessThan(counts[2] ?? 0);
  });

  it("draws each bond as two half-sticks, a double bond as two pairs", () => {
    const parts = moleculeParts(1);
    // Carbon dioxide gives its carbon four half-sticks and each oxygen two;
    // methane gives its carbon four; water gives its oxygen two; every
    // hydrogen has one.
    expect(parts.hydrogen.sticks).toHaveLength(parts.hydrogen.balls.length);
    expect(parts.carbon.sticks).toHaveLength(parts.carbon.balls.length * 4);
    expect(parts.oxygen.sticks).toHaveLength(parts.oxygen.balls.length * 2);
  });

  it("builds linear CO2, bent H2O and tetrahedral CH4", () => {
    const parts = moleculeParts(5);
    const angles = (sticks: typeof parts.carbon.sticks) =>
      Arr.dedupe(
        Arr.flatMap(sticks, (stick, index) =>
          Arr.map(
            Arr.filter(
              Arr.drop(sticks, index + 1),
              (other) => distance(stick.position, other.position) < 0.06
            ),
            (other) => {
              const [ax, ay, az] = stick.up;
              const [bx, by, bz] = other.up;
              const cosine =
                (ax * bx + ay * by + az * bz) /
                (Math.hypot(ax, ay, az) * Math.hypot(bx, by, bz));
              return Math.round(
                (Math.acos(Math.min(1, Math.max(-1, cosine))) * 180) / Math.PI
              );
            }
          )
        )
      );
    // Two sticks of one double bond run side by side, at 0 degrees.
    expect(Arr.sort(angles(parts.carbon.sticks), Order.Number)).toEqual([
      0, 109, 180,
    ]);
    expect(angles(parts.oxygen.sticks)).toContain(105);
  });

  it("stands every atom above the surface and keeps molecules apart", () => {
    const placed = atoms(5);
    for (const atom of placed) {
      expect(Math.hypot(...atom.position)).toBeGreaterThan(
        EARTH_RADIUS + atom.radius
      );
    }
    const overlaps = Arr.flatMap(placed, (atom, index) =>
      Arr.filter(
        Arr.drop(placed, index + 1),
        (other) =>
          distance(atom.position, other.position) <
          (atom.radius + other.radius) * 0.999
      )
    );
    // Only atoms bonded within one molecule could touch, and the balls are
    // small enough that even they never do.
    expect(overlaps).toHaveLength(0);
  });
});
