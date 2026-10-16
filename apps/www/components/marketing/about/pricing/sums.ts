import {
  getPlanCreditConfig,
  NINA_RESPONSE_CREDITS,
} from "@repo/backend/confect/credits/constants";
import { Schema } from "effect";
import type { getProMonthlyPricing } from "@/components/marketing/about/pricing/display";

/** The monthly Pro price of one currency, as the Polar catalog gives it. */
type MonthlyPrice = ReturnType<typeof getProMonthlyPricing>["price"];

/** A month has thirty days in the sums of the pricing page, as the design divides it. */
const DAYS_PER_MONTH = 30;

/** Rupiah for one iced milk coffee, the price of a glass that the design reads. */
const ICED_COFFEE_IDR = 23_000;

/** Takeaway coffees that the euro price buys: the design's estimate, to check against local prices before release. */
const TAKEAWAY_COFFEES_EUR = 3;

/** Lattes that the dollar price buys: the design's estimate, to check against local prices before release. */
const LATTES_USD = 2;

/** The sums that the comparisons of the pricing page show for one monthly price. */
const PricingSumsSchema = Schema.Struct({
  answersPerDay: Schema.Finite,
  answersPerMonth: Schema.Finite,
  drinks: Schema.Finite,
  pricePerDay: Schema.Finite,
});

/** The sums of one monthly price. */
type PricingSums = typeof PricingSumsSchema.Type;

/** How many drinks a monthly price buys in its own currency. */
function drinksFor(price: MonthlyPrice) {
  if (price.currency === "IDR") {
    return Math.floor(price.amount / ICED_COFFEE_IDR);
  }
  if (price.currency === "EUR") {
    return TAKEAWAY_COFFEES_EUR;
  }
  return LATTES_USD;
}

/**
 * The comparisons of one monthly price, computed from the price itself and
 * from the credits of the Pro plan and the credit cost of one Nina answer.
 */
export function pricingSums(price: MonthlyPrice): PricingSums {
  const answersPerMonth = Math.floor(
    getPlanCreditConfig("pro").amount / NINA_RESPONSE_CREDITS
  );
  return {
    answersPerDay: Math.round(answersPerMonth / DAYS_PER_MONTH),
    answersPerMonth,
    drinks: drinksFor(price),
    pricePerDay: price.amount / DAYS_PER_MONTH,
  };
}
