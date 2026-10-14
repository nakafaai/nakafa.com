import { describe, expect, it } from "@effect/vitest";
import {
  isLoginAddress,
  loginAddress,
} from "@repo/backend/confect/identity/address";

describe("identity/address", () => {
  it("names the placeholder address of a global username", () => {
    expect(loginAddress("raka")).toBe("raka@login.nakafa.invalid");
  });

  it("recognizes only the placeholder domain as a placeholder", () => {
    expect(isLoginAddress(loginAddress("raka"))).toBe(true);
    expect(isLoginAddress("raka@harapan.example.test")).toBe(false);
    expect(isLoginAddress("raka@login.nakafa.invalid.example.test")).toBe(
      false
    );
  });
});
