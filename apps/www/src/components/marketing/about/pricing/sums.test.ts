// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  getPlanCreditConfig,
  NINA_RESPONSE_CREDITS,
} from "@repo/backend/confect/credits/constants";
import { pricingSums } from "@/components/marketing/about/pricing/sums";
import { getProMonthlyPricing } from "@/lib/pricing/monthly";

describe("marketing/about/pricing-sums", () => {
  it("counts only the whole iced coffees that a Rupiah price buys", () => {
    const rupiah = getProMonthlyPricing("ID").price;
    const drinksAt = (amount: number) =>
      pricingSums({ ...rupiah, amount }).drinks;

    expect(drinksAt(22_999)).toBe(0);
    expect(drinksAt(23_000)).toBe(1);
    expect(drinksAt(45_999)).toBe(1);
    expect(drinksAt(46_000)).toBe(2);
  });

  it("divides the Rupiah price and the answers of the Pro credits by the days of the month", () => {
    const rupiah = getProMonthlyPricing("ID").price;
    const sums = pricingSums(rupiah);

    expect(sums.pricePerDay).toBe(getProMonthlyPricing("ID").price.amount / 30);
    expect(pricingSums({ ...rupiah, amount: 300 }).pricePerDay).toBe(10);
    expect(sums.answersPerMonth).toBe(
      getPlanCreditConfig("pro").amount / NINA_RESPONSE_CREDITS
    );
    expect(sums.answersPerDay).toBe(Math.round(sums.answersPerMonth / 30));
  });

  it("gives the euro price its takeaway coffees and its price per day", () => {
    const sums = pricingSums(getProMonthlyPricing("DE").price);

    expect(sums.drinks).toBe(3);
    expect(sums.pricePerDay).toBeCloseTo(
      getProMonthlyPricing("DE").price.amount / 30,
      10
    );
    expect(sums.answersPerMonth).toBe(200);
  });

  it("gives the dollar price its lattes and its price per day", () => {
    const sums = pricingSums(getProMonthlyPricing(null).price);

    expect(sums.drinks).toBe(2);
    expect(sums.pricePerDay).toBeCloseTo(
      getProMonthlyPricing(null).price.amount / 30,
      10
    );
    expect(sums.answersPerDay).toBe(7);
  });
});
