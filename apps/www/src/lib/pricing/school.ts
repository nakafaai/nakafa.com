import { BillingCurrency } from "@repo/backend/confect/billing/catalog";
import { Array as Arr, Function as Fn, Option, Schema } from "effect";
import { spaceLetterSymbol } from "@/lib/pricing/monthly";

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
  USD: {
    exact: { currency: "USD", digits: 2, locale: "en-US" },
    whole: { currency: "USD", digits: 0, locale: "en-US" },
  },
} as const satisfies Record<
  BillingCurrency,
  Record<"exact" | "whole", CurrencyFormat>
>;

/** Builds the formatter of one currency format, which loads its locale's data. */
const buildFormatter = (format: CurrencyFormat) =>
  new Intl.NumberFormat(format.locale, {
    currency: format.currency,
    maximumFractionDigits: format.digits,
    minimumFractionDigits: format.digits,
    style: "currency",
  });

/** The formatter of one currency format, built at its first read. */
const formatterOf = Fn.memoize(buildFormatter);

/** A School price in minor units as a number in major units, as structured data states a price. */
export function toMajorUnits(currency: BillingCurrency, minor: number) {
  return minor / 10 ** CURRENCY_FORMATS[currency].exact.digits;
}

/**
 * A School price in minor units, written in its currency's own locale: a whole
 * dollar or euro amount drops its cents, so Pro reads $109 and a discounted month
 * $103.55. The rupiah's symbol takes the same no-break space in every browser.
 */
export function formatSchoolPrice(currency: BillingCurrency, minor: number) {
  const formats = CURRENCY_FORMATS[currency];
  const whole = minor % 10 ** formats.exact.digits === 0;
  return spaceLetterSymbol(
    formatterOf(whole ? formats.whole : formats.exact).format(
      toMajorUnits(currency, minor)
    )
  );
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
  const { amount, unit } = Arr.findFirst(
    STORAGE_UNITS,
    (step) => megabytes >= step.megabytes
  ).pipe(
    Option.match({
      onNone: () => ({ amount: megabytes, unit: "MB" }),
      onSome: (step) => ({
        amount: megabytes / step.megabytes,
        unit: step.unit,
      }),
    })
  );
  const number = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  }).format(amount);
  return `${number}\u00a0${unit}`;
}
