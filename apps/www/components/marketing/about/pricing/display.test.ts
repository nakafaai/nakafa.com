// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { createTranslator } from "next-intl";
import {
  currencySymbol,
  drinkKey,
  getProPricingDisplay,
  pricingCountryHeaderName,
} from "@/components/marketing/about/pricing/display";
import { getProMonthlyPricing } from "@/lib/pricing/monthly";

describe("marketing/about/pricing-display", () => {
  it("uses the Vercel country header name", () => {
    expect(pricingCountryHeaderName).toBe("x-vercel-ip-country");
  });

  it("names each price by the currency symbol of its own locale", () => {
    expect(currencySymbol(getProMonthlyPricing("DE").formatter)).toBe("€");
    expect(currencySymbol(getProMonthlyPricing("ID").formatter)).toBe("Rp");
    expect(currencySymbol(getProMonthlyPricing(null).formatter)).toBe("$");
  });

  it("gives each English drink the form that agrees with its count", async () => {
    const messages = await loadLocaleMessages("en");
    const page = createTranslator({
      locale: "en",
      messages,
      namespace: "PricingPage",
    });

    expect(page(drinkKey("IDR"), { count: 1 })).toBe("iced milk coffee");
    expect(page(drinkKey("IDR"), { count: 3 })).toBe("iced milk coffees");
    expect(page(drinkKey("EUR"), { count: 1 })).toBe("takeaway coffee");
    expect(page(drinkKey("USD"), { count: 1 })).toBe("latte");
    expect(page(drinkKey("USD"), { count: 2 })).toBe("lattes");
  });

  it("gives each German drink the form that agrees with its count", async () => {
    const messages = await loadLocaleMessages("de");
    const page = createTranslator({
      locale: "de",
      messages,
      namespace: "PricingPage",
    });

    expect(page(drinkKey("IDR"), { count: 1 })).toBe("Eiskaffee mit Milch");
    expect(page(drinkKey("IDR"), { count: 3 })).toBe("Eiskaffees mit Milch");
    expect(page(drinkKey("USD"), { count: 1 })).toBe("Latte");
    expect(page(drinkKey("USD"), { count: 2 })).toBe("Lattes");
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
