// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  getProPricingDisplay,
  pricingCountryHeaderName,
} from "@/components/marketing/about/pricing/display";

describe("marketing/about/pricing-display", () => {
  it("uses the Vercel country header name", () => {
    expect(pricingCountryHeaderName).toBe("x-vercel-ip-country");
  });

  it("formats Indonesian pricing from the country code", () => {
    const price = getProPricingDisplay("ID");

    expect(price.pro).toMatchObject({
      locales: "id-ID",
      value: 69_000,
    });
    expect(price.free.text.replace(/\s+/g, " ")).toBe("Rp 0");
    expect(price.pro.text.replace(/\s+/g, " ")).toBe("Rp 69.000");
  });

  it("normalizes lowercase country codes", () => {
    const price = getProPricingDisplay("id");

    expect(price.pro.text.replace(/\s+/g, " ")).toBe("Rp 69.000");
  });

  it("formats euro pricing for Polar EUR countries and territories", () => {
    const countryPrice = getProPricingDisplay("DE");
    const lowercasePrice = getProPricingDisplay("de");
    const territoryPrice = getProPricingDisplay("AX");

    expect(countryPrice.pro).toMatchObject({
      locales: "de-DE",
      value: 8.99,
    });
    expect(countryPrice.free.text.replace(/\s+/g, " ")).toBe("0,00 €");
    expect(countryPrice.pro.text.replace(/\s+/g, " ")).toBe("8,99 €");
    expect(lowercasePrice).toEqual(countryPrice);
    expect(territoryPrice).toEqual(countryPrice);
  });

  it("falls back to USD pricing when Polar has no matching price", () => {
    const countryPrice = getProPricingDisplay("PL");
    const fallbackPrice = getProPricingDisplay(null);

    expect(countryPrice.pro).toMatchObject({
      locales: "en-US",
      value: 8.99,
    });
    expect(countryPrice.free.text).toBe("$0.00");
    expect(countryPrice.pro.text).toBe("$8.99");
    expect(fallbackPrice).toEqual(countryPrice);
  });
});
