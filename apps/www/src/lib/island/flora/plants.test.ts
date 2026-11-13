// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { idOf } from "@repo/backend/confect/island/blocks";
import { PLANT_KEYS } from "@repo/backend/confect/island/flora";
import { Array as Arr, HashSet, Record as Rec } from "effect";
import { PLANT_SLOT, plantPixels } from "@/lib/island/atlas";
import { FLORA } from "@/lib/island/flora/families";
import { plantLookOf, WILD_PLANTS } from "@/lib/island/flora/plants";
import { isPlant, KIND, LOOK } from "@/lib/island/look";

describe("island/flora/plants", () => {
  it("keeps more than a hundred plants from every family, a few growing wild", () => {
    expect(PLANT_KEYS.length).toBeGreaterThan(100);
    expect(
      HashSet.fromIterable(
        Arr.map(PLANT_KEYS, (_key, index) => plantLookOf(index).family)
      )
    ).toEqual(HashSet.fromIterable(Rec.keys(FLORA)));
    expect(WILD_PLANTS.length).toBeGreaterThan(10);
    expect(WILD_PLANTS.length).toBeLessThan(PLANT_KEYS.length);
  });

  it("draws every plant as its own picture, and meshes it as a cross from its own tile", () => {
    const drawings = Arr.map(PLANT_KEYS, (_key, index) =>
      Arr.join(Arr.map(Arr.fromIterable(plantPixels(index)), String), ",")
    );
    expect(HashSet.size(HashSet.fromIterable(drawings))).toBe(
      PLANT_KEYS.length
    );
    Arr.forEach(PLANT_KEYS, (key, index) => {
      expect(isPlant(key)).toBe(true);
      expect(LOOK.kinds[idOf(key)]).toBe(KIND.cross);
      expect(LOOK.sides[idOf(key)]).toBe(PLANT_SLOT + index);
    });
    expect(isPlant("planks")).toBe(false);
  });
});
