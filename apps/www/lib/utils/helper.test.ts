// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getInitialName } from "@/lib/utils/helper";

describe("getInitialName", () => {
  it("uses the default initials when the name is absent", () => {
    expect(getInitialName()).toBe("NF");
  });

  it("uses the default initials when the name is blank", () => {
    expect(getInitialName("   ")).toBe("NF");
  });

  it("returns the uppercase first letter of a single name", () => {
    expect(getInitialName("nabil")).toBe("N");
  });

  it("returns the first and last initials of a full name", () => {
    expect(getInitialName("  ada   lovelace  ")).toBe("AL");
  });
});
