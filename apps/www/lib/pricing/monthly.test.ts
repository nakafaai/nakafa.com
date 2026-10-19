// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { getProMonthlyPricing } from "@/lib/pricing/monthly";

describe("monthly pro price of a country", () => {
  it.each([
    ["ID", "IDR"],
    ["id", "IDR"],
    ["DE", "EUR"],
    ["fr", "EUR"],
    ["EU", "EUR"],
    ["US", "USD"],
    ["ZZ", "USD"],
    [null, "USD"],
  ] as const)("prices country %s in %s", (country, currency) => {
    expect(getProMonthlyPricing(country).currency).toBe(currency);
  });

  it("returns the catalog price of the currency it names", () => {
    expect(getProMonthlyPricing("ID").price.amount).toBe(69_000);
  });
});
