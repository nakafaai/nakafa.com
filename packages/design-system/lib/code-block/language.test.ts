import { describe, expect, it } from "@effect/vitest";
import { isBundledLanguage } from "@repo/design-system/lib/code-block/language";

describe("isBundledLanguage", () => {
  it("accepts a language that Shiki bundles", () => {
    expect(isBundledLanguage("typescript")).toBe(true);
  });

  it("rejects a name that Shiki does not bundle", () => {
    expect(isBundledLanguage("nakafa-script")).toBe(false);
  });

  it("rejects inherited object keys", () => {
    expect(isBundledLanguage("constructor")).toBe(false);
  });
});
