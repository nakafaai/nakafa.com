import {
  getCategoryPath,
  parseArticleCategory,
} from "@repo/contents/_lib/articles/category";
import { Option } from "effect";
import { describe, expect, it } from "vitest";

describe("article category routes", () => {
  it("builds the category path", () => {
    expect(getCategoryPath("politics")).toBe("/articles/politics");
  });

  it("parses supported categories and rejects unknown segments", () => {
    expect(Option.getOrUndefined(parseArticleCategory("politics"))).toBe(
      "politics"
    );
    expect(Option.isNone(parseArticleCategory("unknown"))).toBe(true);
  });
});
