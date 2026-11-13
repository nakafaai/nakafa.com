import { describe, expect, it } from "@effect/vitest";
import {
  admitsAddress,
  NEW_TENANT_POLICIES,
  Policy,
  TenantPolicies,
} from "@repo/backend/confect/tenancy/policy";
import { Array as Arr, Order, Struct } from "effect";

/** The policies of a tenant that allows these email domains. */
const allowing = (emailDomains: readonly string[]) => ({
  ...NEW_TENANT_POLICIES,
  emailDomains,
});

describe("tenancy/policy", () => {
  it("has a case in Policy for each policy a tenant stores, so an Owner can change every one", () => {
    const sorted = Arr.sort(Order.String);

    expect(sorted(Policy.discriminants)).toEqual(
      sorted(Struct.keys(TenantPolicies.fields))
    );
  });

  it("admits every address while the list of email domains is empty", () => {
    const admitted = Arr.map(
      ["kepala@harapan.example.test", "guru@gmail.com", "wali@belajar.id"],
      (address) => admitsAddress(allowing([]), address)
    );

    expect(admitted).toEqual(Arr.replicate(true, 3));
  });

  it("admits an address on any one of the allowed domains", () => {
    const policies = allowing(["belajar.id", "harapan.example.test"]);
    const admitted = Arr.map(
      ["guru@harapan.example.test", "wali@belajar.id"],
      (address) => admitsAddress(policies, address)
    );

    expect(admitted).toEqual(Arr.replicate(true, 2));
  });

  it("refuses every other address, one that only resembles an allowed domain included", () => {
    const policies = allowing(["harapan.example.test"]);
    const admitted = Arr.map(
      [
        "guru@gmail.com",
        "guru@mail.harapan.example.test",
        "guru@evilharapan.example.test",
        "guru@harapan.example.test.evil.id",
      ],
      (address) => admitsAddress(policies, address)
    );

    expect(admitted).toEqual(Arr.replicate(false, 4));
  });

  it("lets a listed belajar.id stand for the subdomains of its levels and roles, and no other domain", () => {
    const policies = allowing(["belajar.id"]);
    expect(
      Arr.map(
        [
          "ayu@guru.sma.belajar.id",
          "ayu@sma.belajar.id",
          "ayu@guru.paud.belajar.id",
          "ayu@admin.belajar.id",
        ],
        (address) => admitsAddress(policies, address)
      )
    ).toEqual(Arr.replicate(true, 4));
    expect(
      Arr.map(
        [
          "ayu@belajar.id.example.test",
          "ayu@notbelajar.id",
          "ayu@belajar.id.gmail.com",
        ],
        (address) => admitsAddress(policies, address)
      )
    ).toEqual(Arr.replicate(false, 3));
    // Only belajar.id stands for its subdomains: any other domain needs its own entry.
    expect(
      admitsAddress(allowing(["sma.belajar.id"]), "ayu@guru.sma.belajar.id")
    ).toBe(false);
  });
});
