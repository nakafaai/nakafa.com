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
    const formatter = new Intl.NumberFormat(
      price.pro.locales,
      price.pro.format
    );

    expect(price.pro).toMatchObject({
      locales: "id-ID",
      value: 69_000,
    });
    expect(formatter.format(price.free.value).replace(/\s+/g, " ")).toBe(
      "Rp 0"
    );
    expect(formatter.format(price.pro.value).replace(/\s+/g, " ")).toBe(
      "Rp 69.000"
    );
  });

  it("normalizes lowercase country codes", () => {
    const price = getProPricingDisplay("id");
    const formatter = new Intl.NumberFormat(
      price.pro.locales,
      price.pro.format
    );

    expect(formatter.format(price.pro.value).replace(/\s+/g, " ")).toBe(
      "Rp 69.000"
    );
  });

  it("falls back to USD pricing outside Indonesia", () => {
    const countryPrice = getProPricingDisplay("US");
    const fallbackPrice = getProPricingDisplay(null);
    const formatter = new Intl.NumberFormat(
      countryPrice.pro.locales,
      countryPrice.pro.format
    );

    expect(countryPrice.pro).toMatchObject({
      locales: "en-US",
      value: 8.99,
    });
    expect(formatter.format(countryPrice.free.value)).toBe("$0.00");
    expect(formatter.format(countryPrice.pro.value)).toBe("$8.99");
    expect(fallbackPrice).toEqual(countryPrice);
  });
});
