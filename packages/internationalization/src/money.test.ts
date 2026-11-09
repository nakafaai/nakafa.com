import { describe, expect, it } from "@effect/vitest";
import {
  currencySymbol,
  formatCurrency,
} from "@repo/internationalization/src/money";

describe("formatCurrency", () => {
  it("writes each currency in its own locale with its own digits", () => {
    expect(
      formatCurrency(79_000, { currency: "IDR", digits: 0, locale: "id-ID" })
    ).toBe("Rp 79.000");
    expect(
      formatCurrency(10, { currency: "USD", digits: 2, locale: "en-US" })
    ).toBe("$10.00");
    expect(
      formatCurrency(10, { currency: "EUR", digits: 2, locale: "de-DE" })
    ).toBe("10,00 €");
    expect(
      formatCurrency(10, { currency: "MYR", digits: 2, locale: "ms-MY" })
    ).toBe("RM 10.00");
  });

  it("writes the same price again from the formatter it built first", () => {
    const money = { currency: "USD", digits: 0, locale: "en-US" };

    expect(formatCurrency(109, money)).toBe("$109");
    expect(formatCurrency(1090, money)).toBe("$1,090");
  });
});

describe("currencySymbol", () => {
  it("names the symbol that a currency writes in one locale", () => {
    expect(currencySymbol("IDR", "id")).toBe("Rp");
    expect(currencySymbol("EUR", "en")).toBe("€");
    expect(currencySymbol("MYR", "ms")).toBe("RM");
  });
});
