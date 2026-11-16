import { describe, expect, it } from "@effect/vitest";
import {
  CrystalIdSchema,
  countIons,
  getCrystal,
  rockSalt,
} from "@repo/design-system/components/contents/chemistry/lattice/crystal";
import { Array as Arr } from "effect";

describe("rock-salt crystals", () => {
  it("fits two touching ion pairs along each cell edge to within five percent", () => {
    for (const id of CrystalIdSchema.literals) {
      const crystal = getCrystal(id);
      const touching = 2 * (crystal.cation.radius + crystal.anion.radius);

      expect(
        Math.abs(touching - crystal.lattice) / crystal.lattice
      ).toBeLessThan(0.05);
    }
  });

  it("builds a cube of 2n + 1 ions per edge with alternating kinds", () => {
    const sites = rockSalt(1);

    expect(sites).toHaveLength(27);
    expect(countIons(sites)).toEqual({ anions: 14, cations: 13 });
    const origin = Arr.findFirst(sites, (site) =>
      Arr.every(site.position, (coordinate) => coordinate === 0)
    );
    expect(origin._tag === "Some" && origin.value.kind).toBe("cation");
  });

  it("surrounds each inner ion with six of the other kind", () => {
    const sites = rockSalt(1);
    const neighbours = Arr.filter(sites, (site) => {
      const [x, y, z] = site.position;
      return Math.abs(x) + Math.abs(y) + Math.abs(z) === 1;
    });

    expect(neighbours).toHaveLength(6);
    expect(Arr.every(neighbours, (site) => site.kind === "anion")).toBe(true);
  });
});
