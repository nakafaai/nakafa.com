import { products } from "@repo/backend/confect/customers/polar/products";
import { HashSet, Schema } from "effect";

/** The currencies that the monthly pro price is shown in, as the Polar catalog names them. */
export const PricingCurrencySchema = Schema.Literals(["EUR", "IDR", "USD"]);

export type PricingCurrency = typeof PricingCurrencySchema.Type;

/**
 * Territory codes that Polar currently maps to EUR through Babel's territory
 * currency data. Keeping the same mapping prevents the marketing price from
 * disagreeing with the checkout currency selected from the forwarded IP.
 *
 * References:
 * - https://github.com/polarsource/polar/blob/11d0edae5ebad634a21c8fbe6bafc5626055951e/server/polar/kit/currency.py
 * - https://github.com/polarsource/polar/blob/11d0edae5ebad634a21c8fbe6bafc5626055951e/server/tests/kit/test_currency.py
 */
const polarEuroTerritoryCodes = HashSet.fromIterable([
  "AD",
  "AT",
  "AX",
  "BE",
  "BL",
  "CY",
  "DE",
  "EA",
  "EE",
  "ES",
  "EU",
  "FI",
  "FR",
  "GF",
  "GP",
  "GR",
  "HR",
  "IC",
  "IE",
  "IT",
  "LT",
  "LU",
  "LV",
  "MC",
  "ME",
  "MF",
  "MQ",
  "MT",
  "NL",
  "PM",
  "PT",
  "RE",
  "SI",
  "SK",
  "SM",
  "TF",
  "VA",
  "XK",
  "YT",
]);

type MonthlyPrice =
  (typeof products.pro.monthlyPrices)[keyof typeof products.pro.monthlyPrices];

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

const eurPricing = makePricing("EUR", products.pro.monthlyPrices.EUR);
const idrPricing = makePricing("IDR", products.pro.monthlyPrices.IDR);
const usdPricing = makePricing("USD", products.pro.monthlyPrices.USD);

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
    HashSet.has(polarEuroTerritoryCodes, normalizedCountryCode)
  ) {
    return eurPricing;
  }

  return usdPricing;
}
