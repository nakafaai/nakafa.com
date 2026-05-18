import { getCategoryIcon } from "@repo/contents/_lib/exercises/category";
import { EXERCISES_CATEGORIES } from "@repo/contents/_types/exercises/category";
import { describe, expect, it } from "vitest";

describe("exercises category helpers", () => {
  it("resolves every category icon", () => {
    for (const category of EXERCISES_CATEGORIES) {
      expect(getCategoryIcon(category)).toBeDefined();
    }

    expect(getCategoryIcon("unknown")).toBeDefined();
  });
});
