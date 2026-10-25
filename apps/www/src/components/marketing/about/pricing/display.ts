import { Array as Arr } from "effect";
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
 * The free and pro prices of one currency, animated and static, with their
 * formatting. The page renders every currency, so no request country selects one.
 *
 * References:
 * - https://polar.sh/docs/features/products#multiple-payment-currencies
 * - https://number-flow.barvian.me/
 */
export function getProPricingDisplay(currency: PricingCurrency) {
  const { format, formatter, price } = getProMonthlyPricingFor(currency);

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
