import { describe, expect, it } from "@effect/vitest";
import { withLeadingSlash } from "@repo/utilities/path";

describe("withLeadingSlash", () => {
  it("roots a relative path and keeps a rooted one", () => {
    expect(withLeadingSlash("articles/politics")).toBe("/articles/politics");
    expect(withLeadingSlash("/articles/politics")).toBe("/articles/politics");
    expect(withLeadingSlash("")).toBe("/");
  });
});
