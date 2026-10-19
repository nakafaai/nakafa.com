import { products } from "@repo/backend/confect/customers/polar/products";
import { Array as Arr, HashSet } from "effect";

export const pricingCountryHeaderName = "x-vercel-ip-country";

/** The first-party cookie that carries the visitor's price currency to the page. */
export const pricingCurrencyCookieName = "pricing_currency";

/** The cookie follows the visitor's country for one day, then the proxy checks it again. */
export const pricingCurrencyMaxAge = 60 * 60 * 24;

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

const eurPrice = products.pro.monthlyPrices.EUR;
const eurFormat = getPriceFormat(eurPrice);
const eurPricing = {
  format: eurFormat,
  formatter: new Intl.NumberFormat(eurPrice.locale, eurFormat),
  price: eurPrice,
};

const idrPrice = products.pro.monthlyPrices.IDR;
const idrFormat = getPriceFormat(idrPrice);
const idrPricing = {
  format: idrFormat,
  formatter: new Intl.NumberFormat(idrPrice.locale, idrFormat),
  price: idrPrice,
};

const usdPrice = products.pro.monthlyPrices.USD;
const usdFormat = getPriceFormat(usdPrice);
const usdPricing = {
  format: usdFormat,
  formatter: new Intl.NumberFormat(usdPrice.locale, usdFormat),
  price: usdPrice,
};

/** One Pro monthly price, in the form the price text and the comparisons read. */
export type ProMonthlyPricing = (typeof proMonthlyPricings)[number];

/**
 * Every Pro monthly price the marketing pages render. Each page renders all of
 * them, and the visitor's currency decides which one is shown.
 */
export const proMonthlyPricings = [idrPricing, eurPricing, usdPricing] as const;

/** Selects the Polar catalog price for the request country. */
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

/** The key of the drink that a monthly price buys in its own currency. */
export function drinkKey(
  currency: string
): "drink-eur" | "drink-idr" | "drink-usd" {
  if (currency === "IDR") {
    return "drink-idr";
  }
  if (currency === "EUR") {
    return "drink-eur";
  }
  return "drink-usd";
}

/**
 * The currency symbol of a price, as its locale writes it. A zero in a currency
 * format always has exactly one currency part, so the symbol is that part.
 */
export function currencySymbol(formatter: Intl.NumberFormat) {
  const currencyParts = Arr.filter(
    formatter.formatToParts(0),
    (part) => part.type === "currency"
  );
  return Arr.join(
    Arr.map(currencyParts, (part) => part.value),
    ""
  );
}

/**
 * Prepares the animated and static price text of each plan in one currency.
 *
 * References:
 * - https://polar.sh/docs/features/products#multiple-payment-currencies
 * - https://number-flow.barvian.me/
 */
export function getProPricingDisplay(pricing: ProMonthlyPricing) {
  const { format, formatter, price } = pricing;

  return {
    free: {
      format,
      locales: price.locale,
      text: formatter.format(0),
      value: 0,
    },
    pro: {
      format,
      locales: price.locale,
      text: formatter.format(price.amount),
      value: price.amount,
    },
  };
}
