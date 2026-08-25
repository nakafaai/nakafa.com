// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  getProPricingDisplay,
  pricingCountryHeaderName,
} from "@/components/marketing/about/pricing-display";

describe("marketing/about/pricing-display", () => {
  it("uses the Vercel country header name", () => {
    expect(pricingCountryHeaderName).toBe("x-vercel-ip-country");
  });

  it("formats Indonesian pricing from the country code", () => {
    const price = getProPricingDisplay("ID");

    expect(price.free.replace(/\s+/g, " ")).toBe("Rp 0");
    expect(price.pro.replace(/\s+/g, " ")).toBe("Rp 69.000");
  });

  it("normalizes lowercase country codes", () => {
    expect(getProPricingDisplay("id")).toEqual(getProPricingDisplay("ID"));
  });

  it("formats euro pricing for Polar EUR countries and territories", () => {
    const countryPrice = getProPricingDisplay("DE");
    const lowercasePrice = getProPricingDisplay("de");
    const territoryPrice = getProPricingDisplay("AX");

    expect(countryPrice.free.replace(/\s+/g, " ")).toBe("0,00 €");
    expect(countryPrice.pro.replace(/\s+/g, " ")).toBe("8,99 €");
    expect(lowercasePrice).toEqual(countryPrice);
    expect(territoryPrice).toEqual(countryPrice);
  });

  it("falls back to USD pricing when Polar has no matching price", () => {
    const countryPrice = getProPricingDisplay("PL");
    const fallbackPrice = getProPricingDisplay(null);

    expect(countryPrice.free).toBe("$0.00");
    expect(countryPrice.pro).toBe("$8.99");
    expect(fallbackPrice).toEqual(countryPrice);
  });
});
