import { Array as Arr } from "effect";
import { getProMonthlyPricing } from "@/lib/pricing/monthly";

export const pricingCountryHeaderName = "x-vercel-ip-country";

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
