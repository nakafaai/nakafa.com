import { timingSafeEqual } from "@repo/utilities/security";
import { describe, expect, it } from "vitest";

describe("timingSafeEqual", () => {
  it("matches identical tokens", () => {
    expect(timingSafeEqual("secret-token", "secret-token")).toBe(true);
  });

  it("rejects missing tokens", () => {
    expect(timingSafeEqual(undefined, "secret-token")).toBe(false);
    expect(timingSafeEqual("secret-token", undefined)).toBe(false);
    expect(timingSafeEqual(undefined, undefined)).toBe(false);
  });

  it("rejects same-length and different-length mismatches", () => {
    expect(timingSafeEqual("secret-token", "secret-tokem")).toBe(false);
    expect(timingSafeEqual("secret-token", "secret")).toBe(false);
    expect(timingSafeEqual("secret", "secret-token")).toBe(false);
  });

  it("compares UTF-8 byte length instead of UTF-16 string length", () => {
    expect(timingSafeEqual("café", "café")).toBe(true);
    expect(timingSafeEqual("café", "cafe")).toBe(false);
  });
});
