import { products } from "@repo/backend/convex/utils/polar/products";

export const pricingCountryHeaderName = "x-vercel-ip-country";

/**
 * Territory codes that Polar currently maps to EUR through Babel's territory
 * currency data. Keeping the same mapping prevents the marketing price from
 * disagreeing with the checkout currency selected from the forwarded IP.
 *
 * References:
 * - https://github.com/polarsource/polar/blob/11d0edae5ebad634a21c8fbe6bafc5626055951e/server/polar/kit/currency.py
 * - https://github.com/polarsource/polar/blob/11d0edae5ebad634a21c8fbe6bafc5626055951e/server/tests/kit/test_currency.py
 */
const polarEuroTerritoryCodes = new Set([
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

/** Selects the Polar catalog price for the request country. */
function getProMonthlyPricing(countryCode: string | null) {
  const normalizedCountryCode = countryCode?.toUpperCase();

  if (normalizedCountryCode === "ID") {
    return idrPricing;
  }

  if (
    normalizedCountryCode &&
    polarEuroTerritoryCodes.has(normalizedCountryCode)
  ) {
    return eurPricing;
  }

  return usdPricing;
}

/**
 * Prepares animated and static price display from Vercel country geolocation.
 *
 * References:
 * - https://examples.vercel.com/kb/guide/geo-ip-headers-geolocation-vercel-functions
 * - https://polar.sh/docs/features/products#multiple-payment-currencies
 * - https://number-flow.barvian.me/
 */
export function getProPricingDisplay(countryCode: string | null) {
  const { format, formatter, price } = getProMonthlyPricing(countryCode);

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
