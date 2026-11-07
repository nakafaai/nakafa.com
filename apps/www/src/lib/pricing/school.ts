import type { BillingCurrency } from "@repo/backend/confect/billing/catalog";
import { Function as Fn } from "effect";
import { spaceLetterSymbol } from "@/lib/pricing/monthly";

/**
 * How each currency is written: the locale that writes it, as the Pro prices are
 * written, so every page spells one price the same, and its minor-unit digits.
 */
const CURRENCY_FORMATS = {
  EUR: { currency: "EUR", digits: 2, locale: "de-DE" },
  IDR: { currency: "IDR", digits: 0, locale: "id-ID" },
  USD: { currency: "USD", digits: 2, locale: "en-US" },
} as const satisfies Record<
  BillingCurrency,
  { currency: BillingCurrency; digits: number; locale: string }
>;

/** Builds the formatter of one currency, which loads its locale's data. */
const buildFormatter = (format: (typeof CURRENCY_FORMATS)[BillingCurrency]) =>
  new Intl.NumberFormat(format.locale, {
    currency: format.currency,
    maximumFractionDigits: format.digits,
    minimumFractionDigits: format.digits,
    style: "currency",
    trailingZeroDisplay: "stripIfInteger",
  });

/** The formatter of one currency, built at its first read. */
const formatterOf = Fn.memoize(buildFormatter);

/**
 * A School price in minor units, written in its currency's own locale: a whole
 * dollar or euro amount drops its cents, so Pro reads $109 and a discounted month
 * $103.55. The rupiah's symbol takes the same no-break space in every browser.
 */
export function formatSchoolPrice(currency: BillingCurrency, minor: number) {
  return spaceLetterSymbol(
    formatterOf(CURRENCY_FORMATS[currency]).format(
      toMajorUnits(currency, minor)
    )
  );
}

/** A School price in minor units as a number in major units, as structured data states a price. */
export function toMajorUnits(currency: BillingCurrency, minor: number) {
  return minor / 10 ** CURRENCY_FORMATS[currency].digits;
}

/** The units of Drive storage, each 1,000 times the one before. */
const STORAGE_UNITS = [
  { megabytes: 1_000_000, unit: "TB" },
  { megabytes: 1000, unit: "GB" },
] as const;

/**
 * Drive storage in megabytes, written in the largest unit it fills, with at most
 * one decimal in the reader's locale: 250 MB, 10.2 GB, 1 TB. The number and the
 * unit never part across a line.
 */
export function formatStorage(megabytes: number, locale: string) {
  const step = STORAGE_UNITS.find((unit) => megabytes >= unit.megabytes);
  const amount = step === undefined ? megabytes : megabytes / step.megabytes;
  const number = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  }).format(amount);
  return `${number} ${step?.unit ?? "MB"}`;
}
