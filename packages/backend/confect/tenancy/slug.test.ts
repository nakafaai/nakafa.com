import { describe, expect, it } from "@effect/vitest";
import {
  NewTenantSlug,
  reservedSlugs,
  TenantSlug,
} from "@repo/backend/confect/tenancy/slug";
import { Array as Arr, HashSet, Schema } from "effect";

const isSlug = Schema.is(TenantSlug);
const isNewSlug = Schema.is(NewTenantSlug);

describe("tenancy/slug", () => {
  it("accepts DNS labels of 2 to 63 lowercase letters, digits, and single inner hyphens", () => {
    expect(
      Arr.every(["nf", "sma-1", "smp-negeri-2-depok", "a".repeat(63)], isSlug)
    ).toBe(true);
  });

  it("rejects labels a host or route could not carry", () => {
    expect(
      Arr.filter(
        [
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
        ],
        isSlug
      )
    ).toEqual([]);
  });

  it("keeps reserved labels valid when stored but refuses them for new tenants", () => {
    const reserved = Arr.fromIterable(reservedSlugs);
    expect(Arr.every(reserved, isSlug)).toBe(true);
    expect(Arr.filter(reserved, isNewSlug)).toEqual([]);
    expect(isNewSlug("sma-nakafa")).toBe(true);
  });

  it("reserves every name the School plan keeps from tenants", () => {
    expect(
      Arr.filter(
        [
          "www",
          "api",
          "mcp",
          "cas",
          "app",
          "admin",
          "auth",
          "docs",
          "status",
          "verify",
          "school",
          "parent",
        ],
        (label) => !HashSet.has(reservedSlugs, label)
      )
    ).toEqual([]);
  });

  it("explains a reserved address", () => {
    expect(() => Schema.decodeSync(NewTenantSlug)("www")).toThrow(
      "This address is reserved."
    );
  });
});
