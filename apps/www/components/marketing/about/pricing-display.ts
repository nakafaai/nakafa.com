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

/** Selects the Polar catalog price for the request country. */
function getProMonthlyPrice(countryCode: string | null) {
  const normalizedCountryCode = countryCode?.toUpperCase();

  if (normalizedCountryCode === "ID") {
    return products.pro.monthlyPrices.IDR;
  }

  if (
    normalizedCountryCode &&
    polarEuroTerritoryCodes.has(normalizedCountryCode)
  ) {
    return products.pro.monthlyPrices.EUR;
  }

  return products.pro.monthlyPrices.USD;
}

/**
 * Prepares NumberFlow pricing props from Vercel country geolocation.
 *
 * References:
 * - https://examples.vercel.com/kb/guide/geo-ip-headers-geolocation-vercel-functions
 * - https://polar.sh/docs/features/products#multiple-payment-currencies
 * - https://number-flow.barvian.me/
 */
export function getProPricingDisplay(countryCode: string | null) {
  const price = getProMonthlyPrice(countryCode);
  const format = {
    currency: price.currency,
    maximumFractionDigits: price.fractionDigits,
    minimumFractionDigits: price.fractionDigits,
    style: "currency",
  } satisfies Intl.NumberFormatOptions;

  return {
    free: {
      format,
      locales: price.locale,
      value: 0,
    },
    pro: {
      format,
      locales: price.locale,
      value: price.amount,
    },
  };
}
