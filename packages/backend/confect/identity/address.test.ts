import { describe, expect, it } from "@effect/vitest";
import {
  isLoginAddress,
  loginAddress,
} from "@repo/backend/confect/identity/address";

describe("identity/address", () => {
  it("names the placeholder address by the key drawn for its account", () => {
    expect(loginAddress("4f8c2a9e")).toBe("4f8c2a9e@login.nakafa.invalid");
  });

  it("recognizes the placeholder domain in every written form", () => {
    expect(isLoginAddress(loginAddress("4f8c2a9e"))).toBe(true);
    expect(isLoginAddress("RAKA@LOGIN.NAKAFA.INVALID")).toBe(true);
    expect(isLoginAddress("<raka@login.nakafa.invalid>")).toBe(true);
    expect(isLoginAddress("raka<raka@login.nakafa.invalid>")).toBe(true);
    expect(isLoginAddress("Raka <raka@login.nakafa.invalid>")).toBe(true);
    expect(isLoginAddress("raka@login.nakafa.invalid.")).toBe(true);
  });

  it("leaves an ordinary address and a near miss of the domain alone", () => {
    expect(isLoginAddress("raka@harapan.example.test")).toBe(false);
    expect(isLoginAddress("raka@xlogin.nakafa.invalid")).toBe(false);
    expect(isLoginAddress("raka@nakafa.invalid")).toBe(false);
  });
});
