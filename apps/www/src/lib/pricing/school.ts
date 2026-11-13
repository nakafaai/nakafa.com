import { BillingCurrency } from "@repo/backend/confect/billing/catalog";
import { formatCurrency } from "@repo/internationalization/src/money";
import { Schema } from "effect";

/** The locale that writes one currency and the fraction digits it shows. */
const CurrencyFormat = Schema.Struct({
  currency: BillingCurrency,
  digits: Schema.Int,
  locale: Schema.String,
});
type CurrencyFormat = typeof CurrencyFormat.Type;

/**
 * How each currency is written: the locale that writes it, as the Pro prices are
 * written, so every page spells one price the same; its minor-unit digits; and
 * the same format without fraction digits for a whole amount.
 */
const CURRENCY_FORMATS = {
  EUR: {
    exact: { currency: "EUR", digits: 2, locale: "de-DE" },
    whole: { currency: "EUR", digits: 0, locale: "de-DE" },
  },
  IDR: {
    exact: { currency: "IDR", digits: 0, locale: "id-ID" },
    whole: { currency: "IDR", digits: 0, locale: "id-ID" },
  },
  MYR: {
    exact: { currency: "MYR", digits: 2, locale: "ms-MY" },
    whole: { currency: "MYR", digits: 0, locale: "ms-MY" },
  },
  USD: {
    exact: { currency: "USD", digits: 2, locale: "en-US" },
    whole: { currency: "USD", digits: 0, locale: "en-US" },
  },
} as const satisfies Record<
  BillingCurrency,
  Record<"exact" | "whole", CurrencyFormat>
>;

/** A School price in minor units as a number in major units, as structured data states a price. */
export function toMajorUnits(currency: BillingCurrency, minor: number) {
  return minor / 10 ** CURRENCY_FORMATS[currency].exact.digits;
}

/**
 * A School price in minor units, written in its currency's own locale: a whole
 * dollar or euro amount drops its cents, so Pro reads $109 and a discounted month
 * $103.55.
 */
export function formatSchoolPrice(currency: BillingCurrency, minor: number) {
  const formats = CURRENCY_FORMATS[currency];
  const whole = minor % 10 ** formats.exact.digits === 0;
  return formatCurrency(
    toMajorUnits(currency, minor),
    whole ? formats.whole : formats.exact
  );
}
