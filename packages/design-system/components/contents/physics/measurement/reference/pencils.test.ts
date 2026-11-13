import { describe, expect, it } from "@effect/vitest";
import {
  DESK_LENGTH,
  REFERENCES,
  ReferenceSchema,
  referenceCount,
} from "@repo/design-system/components/contents/physics/measurement/reference/pencils";

describe("a desk measured in pencils", () => {
  it("counts 8 short pencils, about 6.3 medium ones and 5.5 long ones", () => {
    expect(referenceCount("short")).toEqual({ count: 8, whole: 8 });
    expect(referenceCount("medium").count).toBeCloseTo(6.32, 2);
    expect(referenceCount("medium").whole).toBe(6);
    expect(referenceCount("long").count).toBeCloseTo(5.45, 2);
  });

  it("gives everyone the same 1.2 m with the metre rule", () => {
    expect(referenceCount("rule").count).toBeCloseTo(1.2, 12);
    expect(referenceCount("rule").whole).toBe(1);
  });

  it("multiplies back to the same desk whichever reference is used", () => {
    for (const reference of ReferenceSchema.literals) {
      expect(referenceCount(reference).count * REFERENCES[reference]).toBeCloseTo(DESK_LENGTH, 12);
    }
  });
});
