import {
  getProMonthlyPricingFor,
  type PricingCurrency,
} from "@/lib/pricing/monthly";

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
 * The free and pro prices of one currency, as its locale writes them. The page
 * renders every currency, so no request country selects one.
 *
 * Reference: https://polar.sh/docs/features/products#multiple-payment-currencies
 */
export function getProPricingDisplay(currency: PricingCurrency) {
  const { format, price } = getProMonthlyPricingFor(currency);

  return {
    free: { text: format(0) },
    pro: { text: format(price.amount) },
    proYearly: { text: format(price.yearlyAmount) },
  };
}
