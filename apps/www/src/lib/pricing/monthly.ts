import {
  billingEuroTerritoryCodes,
  proMonthlyPrices,
  proYearlyPrices,
} from "@repo/backend/confect/billing/catalog";
import { HashSet, Schema } from "effect";

/** The currencies that the monthly pro price is shown in, as the Polar catalog names them. */
export const PricingCurrencySchema = Schema.Literals(["EUR", "IDR", "USD"]);

export type PricingCurrency = typeof PricingCurrencySchema.Type;

/** One monthly price as the pages show it: the amount in major units, the yearly amount beside it, with its currency, digits and locale. */
const MonthlyPriceSchema = Schema.Struct({
  amount: Schema.Finite,
  currency: PricingCurrencySchema,
  fractionDigits: Schema.Int,
  locale: Schema.String,
  yearlyAmount: Schema.Finite,
});

type MonthlyPrice = typeof MonthlyPriceSchema.Type;

/** The monthly and yearly prices in one currency: the catalog's minor units, shown in the currency's own digits. */
function monthlyPriceOf(
  currency: PricingCurrency,
  fractionDigits: number,
  locale: string
): MonthlyPrice {
  return {
    amount: proMonthlyPrices[currency] / 10 ** fractionDigits,
    currency,
    fractionDigits,
    locale,
    yearlyAmount: proYearlyPrices[currency] / 10 ** fractionDigits,
  };
}

/** Builds the shared formatting contract for one catalog price. */
function getPriceFormat(price: MonthlyPrice) {
  return {
    currency: price.currency,
    maximumFractionDigits: price.fractionDigits,
    minimumFractionDigits: price.fractionDigits,
    style: "currency",
  } satisfies Intl.NumberFormatOptions;
}

/** The price of one currency with its formatting, as the pages read it. */
function makePricing<Currency extends PricingCurrency>(
  currency: Currency,
  price: MonthlyPrice
) {
  const format = getPriceFormat(price);
  return {
    currency,
    format,
    formatter: new Intl.NumberFormat(price.locale, format),
    price,
  };
}

const eurPricing = makePricing("EUR", monthlyPriceOf("EUR", 2, "de-DE"));
const idrPricing = makePricing("IDR", monthlyPriceOf("IDR", 0, "id-ID"));
const usdPricing = makePricing("USD", monthlyPriceOf("USD", 2, "en-US"));

/** The monthly pro price of every currency, which the static page carries in full. */
const pricingByCurrency = {
  EUR: eurPricing,
  IDR: idrPricing,
  USD: usdPricing,
} satisfies Record<PricingCurrency, unknown>;

/** The monthly pro price of one currency, with its formatting. */
export function getProMonthlyPricingFor(currency: PricingCurrency) {
  return pricingByCurrency[currency];
}

/** Selects the Polar catalog price, with its currency, for the request country. */
export function getProMonthlyPricing(countryCode: string | null) {
  const normalizedCountryCode = countryCode?.toUpperCase();

  if (normalizedCountryCode === "ID") {
    return idrPricing;
  }

  if (
    normalizedCountryCode &&
    HashSet.has(billingEuroTerritoryCodes, normalizedCountryCode)
  ) {
    return eurPricing;
  }

  return usdPricing;
}
