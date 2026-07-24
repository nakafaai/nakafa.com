import { requireFixtureValue } from "@repo/backend/test/tryout-content";
import { describe, expect, it } from "vitest";

describe("test/tryout-content", () => {
  it("requires one concrete fixture value", () => {
    expect(requireFixtureValue(["value"])).toBe("value");
    expect(() => requireFixtureValue([])).toThrow(
      "Expected one try-out content fixture value."
    );
  });
});
