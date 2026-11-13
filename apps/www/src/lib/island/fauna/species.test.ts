// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, HashSet, Record as Rec } from "effect";
import { speciesPixels } from "@/lib/island/atlas";
import { FAMILIES } from "@/lib/island/fauna/families";
import { SPECIES } from "@/lib/island/fauna/species";

/** A species' drawing as one string, to tell drawings apart. */
const drawingOf = (index: number) =>
  Arr.join(Arr.map(Arr.fromIterable(speciesPixels(index)), String), ",");

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
    ).toEqual(HashSet.fromIterable(Rec.keys(FAMILIES)));
  });

  it("draws every species as its own picture, never two alike, at a real height", () => {
    const drawings = Arr.map(SPECIES, (_species, index) => drawingOf(index));
    expect(HashSet.size(HashSet.fromIterable(drawings))).toBe(SPECIES.length);
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
