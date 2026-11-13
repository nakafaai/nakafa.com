// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import {
  getProMonthlyPricing,
  getProMonthlyPricingFor,
} from "@/lib/pricing/monthly";

/** The dollar sign that a USD price carries. */
const DOLLAR_SIGN = /\$/u;

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
    expect(getProMonthlyPricing("ID").price.amount).toBe(79_000);
  });

  it("returns the catalog price of every currency, so the page carries all three", () => {
    expect(getProMonthlyPricingFor("IDR").price.amount).toBe(79_000);
    expect(getProMonthlyPricingFor("EUR").currency).toBe("EUR");
    expect(getProMonthlyPricingFor("USD").currency).toBe("USD");
    expect(getProMonthlyPricingFor("USD").format(8.99)).toMatch(DOLLAR_SIGN);
  });

  it("builds a price's formatter at its first read, and only once", async () => {
    vi.resetModules();
    const build = vi.spyOn(Intl, "NumberFormat");
    const fresh = await import("@/lib/pricing/monthly");

    expect(build).not.toHaveBeenCalled();

    const pricing = fresh.getProMonthlyPricingFor("USD");
    pricing.format(1);
    pricing.format(2);

    expect(build).toHaveBeenCalledOnce();
    expect(pricing.symbol).toBe("$");
    build.mockRestore();
  });
});
