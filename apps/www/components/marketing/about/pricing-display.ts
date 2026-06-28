import { products } from "@repo/backend/convex/utils/polar/products";

export const pricingCountryHeaderName = "x-vercel-ip-country";

/** Selects the Polar catalog price for the request country. */
function getProMonthlyPrice(countryCode: string | null) {
  if (countryCode?.toUpperCase() === "ID") {
    return products.pro.monthlyPrices.ID;
  }

  return products.pro.monthlyPrices.default;
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
