import { getSlugPath } from "@repo/contents/_lib/articles/slug";
import { describe, expect, it } from "vitest";

describe("getSlugPath", () => {
  it("builds the canonical article path", () => {
    expect(getSlugPath("politics", "nepotism-in-political-governance")).toBe(
      "/articles/politics/nepotism-in-political-governance"
    );
  });
});
