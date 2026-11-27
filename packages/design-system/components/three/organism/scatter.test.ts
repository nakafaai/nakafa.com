import { describe, expect, it } from "@effect/vitest";
import { scatter } from "@repo/design-system/components/three/organism/scatter";
import { Matrix4, Vector3 } from "three";

describe("scatter", () => {
  it("writes one placement a copy, each at its own place, size and lean", () => {
    const placements = scatter(3, 5, (index) => ({
      lean: [0, 0, Math.PI / 2],
      place: [index, 2, 0],
      size: [2, 1, 1],
    }));
    const tip = new Vector3(1, 0, 0).applyMatrix4(
      new Matrix4().fromArray(placements, 32)
    );

    expect(placements).toHaveLength(48);
    expect(tip.x).toBeCloseTo(2);
    expect(tip.y).toBeCloseTo(4);
  });

  it("gives each copy chances that stay the same on every visit", () => {
    const sizes = () =>
      scatter(4, 9, (_index, chance) => ({
        lean: [0, 0, 0],
        place: [0, 0, 0],
        size: [1 + chance(1), 1, 1],
      }));

    expect(Array.from(sizes())).toEqual(Array.from(sizes()));
    expect(sizes()[0]).not.toBe(sizes()[16]);
    expect(sizes()[0]).toBeGreaterThanOrEqual(1);
    expect(sizes()[0]).toBeLessThan(2);
  });
});
