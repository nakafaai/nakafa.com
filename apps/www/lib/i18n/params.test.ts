// @vitest-environment node

import { describe, expect, it } from "vitest";
import { getLocaleOrThrow } from "@/lib/i18n/params";

describe("getLocaleOrThrow", () => {
  it("returns a configured locale", () => {
    expect(getLocaleOrThrow("en")).toBe("en");
  });

  it("rejects an unsupported locale", () => {
    expect(() => getLocaleOrThrow("de")).toThrow();
  });
});
