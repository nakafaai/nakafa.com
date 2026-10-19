// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { getLocaleOrThrow } from "@/lib/i18n/params";

describe("getLocaleOrThrow", () => {
  it("returns every public locale of the contract", () => {
    expect(getLocaleOrThrow("en")).toBe("en");
    expect(getLocaleOrThrow("id")).toBe("id");
    expect(getLocaleOrThrow("de")).toBe("de");
  });

  it("rejects a locale outside the contract", () => {
    expect(() => getLocaleOrThrow("fr")).toThrow();
    expect(() => getLocaleOrThrow("")).toThrow();
  });
});
