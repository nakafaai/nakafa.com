import { describe, expect, it } from "@effect/vitest";
import { isActiveLocale } from "@/lib/i18n/active";

describe("active locale", () => {
  it("accepts every active signed production locale", () => {
    expect(isActiveLocale("en")).toBe(true);
    expect(isActiveLocale("id")).toBe(true);
    expect(isActiveLocale("de")).toBe(true);
    expect(isActiveLocale("fr")).toBe(false);
  });
});
