import { EvilIcon } from "@hugeicons/core-free-icons";
import {
  getCategoryIcon,
  getCategoryPath,
  parseArticleCategory,
} from "@repo/contents/_lib/articles/category";
import { describe, expect, it } from "vitest";

describe("article category routes", () => {
  it("builds the category path", () => {
    expect(getCategoryPath("politics")).toBe("/articles/politics");
  });

  it("resolves the category icon", () => {
    expect(getCategoryIcon("politics")).toBe(EvilIcon);
  });

  it("parses supported categories and rejects unknown segments", () => {
    expect(parseArticleCategory("politics")).toBe("politics");
    expect(parseArticleCategory("unknown")).toBeNull();
  });
});
