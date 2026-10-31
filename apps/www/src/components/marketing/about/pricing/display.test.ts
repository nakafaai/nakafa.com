// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { createTranslator } from "use-intl/core";
import {
  drinkKey,
  getProPricingDisplay,
} from "@/components/marketing/about/pricing/display";
import { getProMonthlyPricingFor } from "@/lib/pricing/monthly";

describe("marketing/about/pricing-display", () => {
  it("names each price by the currency symbol of its own locale", () => {
    expect(getProMonthlyPricingFor("EUR").symbol).toBe("€");
    expect(getProMonthlyPricingFor("IDR").symbol).toBe("Rp");
    expect(getProMonthlyPricingFor("USD").symbol).toBe("$");
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

    expect(price.free.text).toBe("Rp\u00a00");
    expect(price.pro.text).toBe("Rp\u00a079.000");
    expect(price.proYearly.text).toBe("Rp\u00a0790.000");
  });

  it("formats euro pricing in the German locale", () => {
    const price = getProPricingDisplay("EUR");

    expect(price.free.text.replace(/\s+/gu, " ")).toBe("0,00 €");
    expect(price.pro.text.replace(/\s+/gu, " ")).toBe("8,99 €");
    expect(price.proYearly.text.replace(/\s+/gu, " ")).toBe("89,90 €");
  });

  it("formats dollar pricing in the English locale", () => {
    const price = getProPricingDisplay("USD");

    expect(price.free.text).toBe("$0.00");
    expect(price.pro.text).toBe("$8.99");
    expect(price.proYearly.text).toBe("$89.90");
  });
});
