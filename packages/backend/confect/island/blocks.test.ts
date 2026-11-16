import { describe, expect, it } from "@effect/vitest";
import {
  AIR,
  BLOCK_KEYS,
  idOf,
  isOpen,
  keyOf,
  opensAt,
} from "@repo/backend/confect/island/blocks";
import { Array as Arr, Option } from "effect";

describe("island/blocks", () => {
  it("stores every block by its own id, in the order of the catalog, so air keeps 0", () => {
    expect(Arr.map(BLOCK_KEYS, idOf)).toEqual(
      Arr.makeBy(BLOCK_KEYS.length, (index) => index + 1)
    );
    expect(
      Arr.map(BLOCK_KEYS, (key) => Option.getOrNull(keyOf(idOf(key))))
    ).toEqual([...BLOCK_KEYS]);
  });

  it("names no block for air or an id past the catalog", () => {
    expect(keyOf(AIR)).toEqual(Option.none());
    expect(keyOf(BLOCK_KEYS.length + 1)).toEqual(Option.none());
  });

  it("opens the first shelf at level 1 and each later block at its level", () => {
    expect(opensAt("grass")).toBe(1);
    expect(isOpen("planks", 1)).toBe(true);
    expect(isOpen("lantern", 3)).toBe(false);
    expect(isOpen("lantern", 4)).toBe(true);
    expect(Arr.every(BLOCK_KEYS, (key) => isOpen(key, 7))).toBe(true);
  });
});
