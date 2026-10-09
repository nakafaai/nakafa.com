import { describe, expect, it } from "@effect/vitest";
import { cleanSlug, toAnchorSlug } from "@repo/utilities/slug";

describe("toAnchorSlug", () => {
  it("lowercases the text and joins its words with hyphens", () => {
    expect(toAnchorSlug("Linear  Equations\tin Two Variables")).toBe(
      "linear-equations-in-two-variables"
    );
  });
});

describe("cleanSlug", () => {
  it("removes every leading and trailing slash", () => {
    expect(cleanSlug("///articles/education///")).toBe("articles/education");
  });

  it("preserves internal slashes and characters", () => {
    expect(cleanSlug("/materi/café//dasar/")).toBe("materi/café//dasar");
  });

  it("returns an empty string for a slash-only value", () => {
    expect(cleanSlug("///")).toBe("");
  });

  it("does not trim whitespace", () => {
    expect(cleanSlug(" /articles/ ")).toBe(" /articles/ ");
  });
});
