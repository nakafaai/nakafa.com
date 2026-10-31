// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import {
  getProMonthlyPricing,
  getProMonthlyPricingFor,
  spaceLetterSymbol,
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

  it("writes rupiah alike for an engine that puts no space after the symbol, as Safari does", () => {
    expect(spaceLetterSymbol("Rp79.000")).toBe("Rp\u00a079.000");
    expect(spaceLetterSymbol("Rp\u00a079.000")).toBe("Rp\u00a079.000");
  });

  it("leaves a price whose symbol is no word as its locale writes it", () => {
    expect(spaceLetterSymbol("$8.99")).toBe("$8.99");
    expect(spaceLetterSymbol("8,99\u00a0€")).toBe("8,99\u00a0€");
  });
});
