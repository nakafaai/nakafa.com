import { describe, expect, it } from "@effect/vitest";
import { lumpAt } from "@repo/design-system/components/contents/biology/cell/lump";
import { Array as Arr } from "effect";

describe("lumpAt", () => {
  it("swells and dips within its depth, the same for the same seed", () => {
    const radii = Arr.map(Arr.range(0, 199), (index) => {
      const turn = index * 0.61;
      const height = Math.cos(index * 0.17);
      const flat = Math.sqrt(1 - height * height);
      return lumpAt(
        Math.cos(turn) * flat,
        height,
        Math.sin(turn) * flat,
        5,
        0.2
      );
    });
    expect(Math.min(...radii)).toBeGreaterThanOrEqual(0.8);
    expect(Math.max(...radii)).toBeLessThanOrEqual(1.2);
    expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(0.1);
    expect(lumpAt(0.3, 0.4, 0.5, 5, 0.2)).toBe(lumpAt(0.3, 0.4, 0.5, 5, 0.2));
    expect(lumpAt(0.3, 0.4, 0.5, 6, 0.2)).not.toBe(
      lumpAt(0.3, 0.4, 0.5, 5, 0.2)
    );
  });

  it("is a sphere at no depth", () => {
    expect(lumpAt(1, 0, 0, 3, 0)).toBe(1);
  });
});
