// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { KINDS } from "@/lib/island/loose";
import { Fruit, fruitFaces } from "@/lib/island/models/fruit";
import { boundsOf, flatten, MODEL_STRIDE } from "@/lib/island/models/parts";
import { SCALE } from "@/lib/island/scale";

describe("island/models/fruit", () => {
  it("builds every fruit about its own middle, at its real size", () => {
    const across = { banana: 0.22, coconut: 0.26, mango: 0.16 } as const;
    for (const kind of Fruit.literals) {
      const { x, y, z } = boundsOf(fruitFaces(kind));
      expect((x[1] - x[0]) * SCALE.block).toBeGreaterThan(across[kind] * 0.8);
      expect((x[1] - x[0]) * SCALE.block).toBeLessThan(across[kind] * 1.2);
      expect(Math.abs(x[0] + x[1])).toBeLessThan(0.05);
      expect(Math.abs(z[0] + z[1])).toBeLessThan(0.05);
      expect(y[0]).toBeLessThan(0);
      expect(y[1]).toBeGreaterThan(0);
    }
  });

  it("rests each fruit on the ground where its model's underside is, within a finger of the weight it rolls with", () => {
    for (const kind of Fruit.literals) {
      const { y } = boundsOf(fruitFaces(kind));
      expect(Math.abs(-y[0] - KINDS[kind].radius)).toBeLessThan(0.04);
    }
  });

  it("draws every fruit as whole triangles", () => {
    for (const kind of Fruit.literals) {
      const corners = flatten(fruitFaces(kind));
      expect(corners.length).toBeGreaterThan(0);
      expect(corners.length % (3 * MODEL_STRIDE)).toBe(0);
    }
  });
});
