import { describe, expect, it } from "@effect/vitest";
import {
  addMaterials,
  coversMaterials,
  lessMaterials,
  NO_MATERIALS,
} from "@repo/backend/confect/island/material";

describe("island materials", () => {
  it("adds, takes and compares every material at once", () => {
    const held = addMaterials(NO_MATERIALS, { petals: 3, wood: 4 });
    expect(held).toEqual({ petals: 3, wood: 4 });
    expect(lessMaterials(held, { petals: 1, wood: 4 })).toEqual({
      petals: 2,
      wood: 0,
    });
    expect(coversMaterials(held, { petals: 3, wood: 1 })).toBe(true);
    expect(coversMaterials(held, { petals: 0, wood: 5 })).toBe(false);
  });
});
