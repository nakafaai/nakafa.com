import { describe, expect, it } from "@effect/vitest";
import {
  admitsAddress,
  admitsHostedDomains,
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

  it("admits every account by its Google sign-ins while the list of email domains is empty", () => {
    const admitted = Arr.map(
      [[], [null], ["harapan.example.test"]],
      (domains) => admitsHostedDomains(allowing([]), domains)
    );

    expect(admitted).toEqual(Arr.replicate(true, 3));
  });

  it("admits an account whose every Google sign-in names an allowed domain as its hosted domain", () => {
    const policies = allowing(["belajar.id", "harapan.example.test"]);
    const admitted = Arr.map(
      [["harapan.example.test"], ["belajar.id", "harapan.example.test"]],
      (domains) => admitsHostedDomains(policies, domains)
    );

    expect(admitted).toEqual(Arr.replicate(true, 2));
  });

  it("refuses an account without a Google sign-in, with a personal Google account, or with a Google account of another domain", () => {
    const policies = allowing(["harapan.example.test"]);
    const admitted = Arr.map(
      [
        [],
        [null],
        ["gmail.com"],
        ["harapan.example.test", null],
        ["mail.harapan.example.test"],
      ],
      (domains) => admitsHostedDomains(policies, domains)
    );

    expect(admitted).toEqual(Arr.replicate(false, 5));
  });
});
