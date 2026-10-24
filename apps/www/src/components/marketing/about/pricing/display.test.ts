// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { createTranslator } from "use-intl/core";
import {
  currencySymbol,
  drinkKey,
  getProPricingDisplay,
} from "@/components/marketing/about/pricing/display";
import { getProMonthlyPricingFor } from "@/lib/pricing/monthly";

describe("marketing/about/pricing-display", () => {
  it("names each price by the currency symbol of its own locale", () => {
    expect(currencySymbol(getProMonthlyPricingFor("EUR").formatter)).toBe("€");
    expect(currencySymbol(getProMonthlyPricingFor("IDR").formatter)).toBe("Rp");
    expect(currencySymbol(getProMonthlyPricingFor("USD").formatter)).toBe("$");
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

  it("formats Indonesian pricing in rupiah", () => {
    const price = getProPricingDisplay("IDR");

    expect(price.pro).toMatchObject({
      locales: "id-ID",
      value: 79_000,
    });
    expect(price.free.text.replace(/\s+/g, " ")).toBe("Rp 0");
    expect(price.pro.text.replace(/\s+/g, " ")).toBe("Rp 79.000");
  });

  it("formats euro pricing in the German locale", () => {
    const price = getProPricingDisplay("EUR");

    expect(price.pro).toMatchObject({
      locales: "de-DE",
      value: 8.99,
    });
    expect(price.free.text.replace(/\s+/g, " ")).toBe("0,00 €");
    expect(price.pro.text.replace(/\s+/g, " ")).toBe("8,99 €");
  });

  it("formats dollar pricing in the English locale", () => {
    const price = getProPricingDisplay("USD");

    expect(price.pro).toMatchObject({
      locales: "en-US",
      value: 8.99,
    });
    expect(price.free.text).toBe("$0.00");
    expect(price.pro.text).toBe("$8.99");
  });
});
