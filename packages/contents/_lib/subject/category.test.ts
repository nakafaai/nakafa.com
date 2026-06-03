import {
  getCategoryPath,
  parseSubjectCategory,
} from "@repo/contents/_lib/subject/category";
import { Option } from "effect";
import { describe, expect, it } from "vitest";

describe("subject category helpers", () => {
  it("builds category routes", () => {
    expect(getCategoryPath("high-school")).toBe("/subject/high-school");
  });

  it("parses valid category segments and rejects invalid ones", () => {
    expect(Option.getOrUndefined(parseSubjectCategory("high-school"))).toBe(
      "high-school"
    );
    expect(Option.isNone(parseSubjectCategory("not-a-category"))).toBe(true);
  });
});
