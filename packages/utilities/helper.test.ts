import { cleanSlug, createStableId } from "@repo/utilities/helper";
import { describe, expect, it } from "vitest";

const STABLE_ID_PATTERN = /^json-ld-[a-z0-9]+$/;

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

describe("createStableId", () => {
  it("returns the same id for the same input", () => {
    expect(createStableId("json-ld", "Nakafa")).toBe(
      createStableId("json-ld", "Nakafa")
    );
  });

  it("keeps the prefix readable", () => {
    expect(createStableId("json-ld", "Nakafa")).toMatch(STABLE_ID_PATTERN);
  });

  it("changes when the input changes", () => {
    expect(createStableId("json-ld", "Nakafa")).not.toBe(
      createStableId("json-ld", "Nakafa AI")
    );
  });

  it("supports an empty payload", () => {
    expect(createStableId("content", "")).toBe("content-0");
  });
});
