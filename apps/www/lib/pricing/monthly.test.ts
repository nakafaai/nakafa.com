// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import {
  getProMonthlyPriceTexts,
  getProMonthlyPricing,
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
    expect(getProMonthlyPricing("ID").price.amount).toBe(69_000);
  });

  it("writes the price of every currency, so the page carries all three", () => {
    const texts = getProMonthlyPriceTexts();
    expect(texts.IDR).toBe(
      new Intl.NumberFormat("id-ID", {
        currency: "IDR",
        maximumFractionDigits: 0,
        minimumFractionDigits: 0,
        style: "currency",
      }).format(69_000)
    );
    expect(texts.EUR).toBe(
      new Intl.NumberFormat("de-DE", {
        currency: "EUR",
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
        style: "currency",
      }).format(8.99)
    );
    expect(texts.USD).toMatch(DOLLAR_SIGN);
  });
});
