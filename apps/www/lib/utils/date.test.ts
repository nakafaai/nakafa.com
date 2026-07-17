// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getLocale } from "@/lib/utils/date";

describe("getLocale", () => {
  it("returns the English date locale", () => {
    expect(getLocale("en").code).toBe("en-US");
  });

  it("returns the Indonesian date locale", () => {
    expect(getLocale("id").code).toBe("id");
  });

  it("falls back to English for an unsupported locale", () => {
    expect(getLocale("de").code).toBe("en-US");
  });

  it("falls back to English when the locale is absent", () => {
    expect(getLocale()).toHaveProperty("code", "en-US");
  });
});
