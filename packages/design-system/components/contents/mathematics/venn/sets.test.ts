// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  OBJECT_ATTRIBUTES,
  OPERATION_MATH,
  OPERATION_TEXT,
  regionOf,
  selects,
  VennObjectSchema,
  VennOperationSchema,
} from "@repo/design-system/components/contents/mathematics/venn/sets";
import { Array as Arr } from "effect";

describe("objects and their sets", () => {
  it("gives every object one to three attributes, each once", () => {
    for (const object of VennObjectSchema.literals) {
      const attributes = OBJECT_ATTRIBUTES[object];
      expect(attributes.length).toBeGreaterThanOrEqual(1);
      expect(attributes.length).toBeLessThanOrEqual(3);
      expect(Arr.dedupe(attributes)).toHaveLength(attributes.length);
    }
  });

  it("writes an object's region as one bit for each set it belongs to", () => {
    expect(regionOf("red-ball", ["red", "plastic", "ball"])).toBe(7);
    expect(regionOf("apple", ["red", "ball"])).toBe(1);
    expect(regionOf("tennis-ball", ["red", "ball"])).toBe(2);
    expect(regionOf("coin", ["red", "ball"])).toBe(0);
  });
});

describe("operations on sets", () => {
  it("selects the regions each operation names", () => {
    const pick = (operation: (typeof VennOperationSchema.literals)[number]) =>
      Arr.filter(Arr.range(0, 7), (region) => selects(operation, region));
    expect(pick("intersection")).toEqual([3, 7]);
    expect(pick("union")).toEqual([1, 2, 3, 5, 6, 7]);
    expect(pick("complement")).toEqual([0, 2, 4, 6]);
    expect(pick("outside-union")).toEqual([0, 4]);
    expect(pick("difference")).toEqual([1, 5]);
    expect(pick("triple-intersection")).toEqual([7]);
    expect(pick("union-with-pair")).toEqual([1, 3, 5, 6, 7]);
  });

  it("names set C in the same operations in both of its notations", () => {
    for (const operation of VennOperationSchema.literals) {
      expect(OPERATION_TEXT[operation].includes("C")).toBe(
        OPERATION_MATH[operation].includes("C")
      );
    }
  });
});
