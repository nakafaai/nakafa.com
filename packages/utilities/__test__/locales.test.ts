import { defaultLocale, locales } from "@repo/utilities/locales";
import { describe, expect, it } from "vitest";

describe("locales", () => {
  it("uses a supported locale as the default", () => {
    expect(locales).toContain(defaultLocale);
  });

  it("keeps supported locales unique", () => {
    expect(new Set(locales).size).toBe(locales.length);
  });
});
