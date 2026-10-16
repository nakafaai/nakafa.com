import { describe, expect, it } from "@effect/vitest";
import {
  isLoginAddress,
  loginAddress,
} from "@repo/backend/confect/identity/address";

describe("identity/address", () => {
  it("names the placeholder address by the key drawn for its account", () => {
    expect(loginAddress("4f8c2a9e")).toBe("4f8c2a9e@login.nakafa.invalid");
  });

  it("recognizes only the placeholder domain as a placeholder", () => {
    expect(isLoginAddress(loginAddress("4f8c2a9e"))).toBe(true);
    expect(isLoginAddress("raka@harapan.example.test")).toBe(false);
    expect(isLoginAddress("raka@login.nakafa.invalid.example.test")).toBe(
      false
    );
  });
});
