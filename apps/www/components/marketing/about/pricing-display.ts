import { products } from "@repo/backend/convex/utils/polar/products";

export const pricingCountryHeaderName = "x-vercel-ip-country";

type MonthlyPrice =
  (typeof products.pro.monthlyPrices)[keyof typeof products.pro.monthlyPrices];

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

function createPricingDisplay(price: MonthlyPrice) {
  const formatter = new Intl.NumberFormat(price.locale, {
    currency: price.currency,
    maximumFractionDigits: price.fractionDigits,
    minimumFractionDigits: price.fractionDigits,
    style: "currency",
  });

  return {
    free: formatter.format(0),
    pro: formatter.format(price.amount),
  };
}

const indonesianPricingDisplay = createPricingDisplay(
  products.pro.monthlyPrices.IDR
);
const euroPricingDisplay = createPricingDisplay(products.pro.monthlyPrices.EUR);
const defaultPricingDisplay = createPricingDisplay(
  products.pro.monthlyPrices.USD
);

/** Selects the formatted Polar catalog price for the request country. */
export function getProPricingDisplay(countryCode: string | null) {
  const normalizedCountryCode = countryCode?.toUpperCase();

  if (normalizedCountryCode === "ID") {
    return indonesianPricingDisplay;
  }

  if (
    normalizedCountryCode &&
    polarEuroTerritoryCodes.has(normalizedCountryCode)
  ) {
    return euroPricingDisplay;
  }

  return defaultPricingDisplay;
}
