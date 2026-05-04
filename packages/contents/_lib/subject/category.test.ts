import {
  getCategoryIcon,
  getCategoryPath,
  parseSubjectCategory,
} from "@repo/contents/_lib/subject/category";
import { SubjectCategorySchema } from "@repo/contents/_types/subject/category";
import { describe, expect, it } from "vitest";

describe("subject category helpers", () => {
  it("builds category routes", () => {
    expect(getCategoryPath("high-school")).toBe("/subject/high-school");
  });

  it("resolves every category icon", () => {
    for (const category of SubjectCategorySchema.options) {
      expect(getCategoryIcon(category)).toBeDefined();
    }

    expect(getCategoryIcon("unknown")).toBeDefined();
  });

  it("parses valid category segments and rejects invalid ones", () => {
    expect(parseSubjectCategory("high-school")).toBe("high-school");
    expect(parseSubjectCategory("not-a-category")).toBeNull();
  });
});
