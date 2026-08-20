import { describe, expect, it } from "vitest";
import { isActiveLocale } from "@/lib/i18n/active";

describe("active locale", () => {
  it("distinguishes signed production locales from preview candidates", () => {
    expect(isActiveLocale("en")).toBe(true);
    expect(isActiveLocale("id")).toBe(true);
    expect(isActiveLocale("de")).toBe(false);
  });
});
