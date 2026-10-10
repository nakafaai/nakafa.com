import { describe, expect, it } from "@effect/vitest";
import { slugify } from "@repo/backend/confect/schools/slugify";

describe("utils/text", () => {
  it("turns display text into a stable slug", () => {
    expect(slugify("  Nakafa: Math & Science!  ")).toBe("nakafa-math-science");
  });
});
