import { topUpPrices } from "@repo/backend/confect/billing/catalog";
import {
  getProMonthlyPricingFor,
  type PricingCurrency,
} from "@/lib/pricing/monthly";

/** The price of one top-up pack in one currency, in the digits and locale the pricing pages use for that currency. */
export function topUpPriceText(currency: PricingCurrency) {
  const { formatter, price } = getProMonthlyPricingFor(currency);
  return formatter.format(topUpPrices[currency] / 10 ** price.fractionDigits);
}
