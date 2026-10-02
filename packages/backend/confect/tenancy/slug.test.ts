import { describe, expect, it } from "@effect/vitest";
import {
  NewTenantSlug,
  reservedSlugs,
  TenantSlug,
} from "@repo/backend/confect/tenancy/slug";
import { Schema } from "effect";

const isSlug = Schema.is(TenantSlug);
const isNewSlug = Schema.is(NewTenantSlug);

describe("tenancy/slug", () => {
  it("accepts DNS labels of 2 to 63 lowercase letters, digits, and single inner hyphens", () => {
    for (const slug of ["nf", "sma-1", "smp-negeri-2-depok", "a".repeat(63)]) {
      expect(isSlug(slug)).toBe(true);
    }
  });

  it("rejects labels a host or route could not carry", () => {
    for (const slug of [
      "t",
      "a".repeat(64),
      "-nf",
      "nf-",
      "sma--1",
      "xn--nf",
      "Nakafa",
      "sma_1",
      "sma 1",
      "",
    ]) {
      expect(isSlug(slug)).toBe(false);
    }
  });

  it("keeps reserved labels valid when stored but refuses them for new tenants", () => {
    for (const slug of reservedSlugs) {
      expect(isSlug(slug)).toBe(true);
      expect(isNewSlug(slug)).toBe(false);
    }
    expect(isNewSlug("sma-nakafa")).toBe(true);
  });

  it("explains a reserved address", () => {
    expect(() => Schema.decodeSync(NewTenantSlug)("www")).toThrow(
      "This address is reserved."
    );
  });
});
