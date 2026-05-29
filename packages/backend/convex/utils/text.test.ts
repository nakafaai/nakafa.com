import { slugify, truncateText } from "@repo/backend/convex/utils/text";
import { describe, expect, it } from "vitest";

describe("utils/text", () => {
  it("turns display text into a stable slug", () => {
    expect(slugify("  Nakafa: Math & Science!  ")).toBe("nakafa-math-science");
  });

  it("keeps short text unchanged", () => {
    expect(truncateText({ text: "Short preview", maxLength: 20 })).toBe(
      "Short preview"
    );
  });

  it("truncates long text at the requested length", () => {
    expect(truncateText({ text: "Long preview text", maxLength: 12 })).toBe(
      "Long preview…"
    );
  });

  it("uses the default preview length when no limit is provided", () => {
    const text = `${"a".repeat(205)} tail`;

    expect(truncateText({ text })).toBe(`${"a".repeat(200)}…`);
  });
});
