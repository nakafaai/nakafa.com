import { EvilIcon } from "@hugeicons/core-free-icons";
import { describe, expect, it } from "vitest";
import { getArticleCategoryIcon } from "@/components/articles/category";

describe("article category presentation", () => {
  it("uses the established politics icon", () => {
    expect(getArticleCategoryIcon("politics")).toBe(EvilIcon);
  });
});
