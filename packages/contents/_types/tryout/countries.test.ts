import { describe, expect, it } from "vitest";
import { readTryoutCountryCode } from "./countries";

describe("tryout/countries", () => {
  it("reads source-owned country codes by country key", () => {
    expect(readTryoutCountryCode("indonesia")).toBe("ID");
  });

  it("returns undefined for unknown country keys", () => {
    expect(readTryoutCountryCode("unknown")).toBeUndefined();
  });
});
