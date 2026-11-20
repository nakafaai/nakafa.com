// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, HashSet } from "effect";
import { Family } from "@/lib/island/fauna/families";
import { SPECIES } from "@/lib/island/fauna/species";

describe("island/fauna/species", () => {
  it("keeps more than a hundred real species, each named once, from every family", () => {
    expect(SPECIES.length).toBeGreaterThan(100);
    expect(
      HashSet.size(
        HashSet.fromIterable(Arr.map(SPECIES, (species) => species.key))
      )
    ).toBe(SPECIES.length);
    expect(
      HashSet.fromIterable(Arr.map(SPECIES, (species) => species.family))
    ).toEqual(HashSet.fromIterable(Family.literals));
  });

  it("gives every species a real height", () => {
    expect(
      Arr.every(SPECIES, (species) => species.height > 0 && species.height <= 6)
    ).toBe(true);
    const giraffe = Arr.findFirstIndex(
      SPECIES,
      (species) => species.key === "giraffe"
    );
    const cat = Arr.findFirstIndex(SPECIES, (species) => species.key === "cat");
    expect(giraffe._tag === "Some" && cat._tag === "Some").toBe(true);
  });
});
