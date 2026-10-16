// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  getPlanCreditConfig,
  NINA_RESPONSE_CREDITS,
} from "@repo/backend/confect/credits/constants";
import { products } from "@repo/backend/confect/customers/polar/products";
import { getProMonthlyPricing } from "@/components/marketing/about/pricing/display";
import { pricingSums } from "@/components/marketing/about/pricing/sums";

describe("marketing/about/pricing-sums", () => {
  it("counts the iced coffees, the price per day and the answers of the Rupiah price", () => {
    const sums = pricingSums(getProMonthlyPricing("ID").price);

    expect(sums.drinks).toBe(
      Math.floor(products.pro.monthlyPrices.IDR.amount / 23_000)
    );
    expect(sums.pricePerDay).toBe(products.pro.monthlyPrices.IDR.amount / 30);
    expect(sums.answersPerMonth).toBe(
      getPlanCreditConfig("pro").amount / NINA_RESPONSE_CREDITS
    );
    expect(sums.answersPerDay).toBe(Math.round(sums.answersPerMonth / 30));
  });

  it("gives the euro price its takeaway coffees and its price per day", () => {
    const sums = pricingSums(getProMonthlyPricing("DE").price);

    expect(sums.drinks).toBe(3);
    expect(sums.pricePerDay).toBeCloseTo(
      products.pro.monthlyPrices.EUR.amount / 30,
      10
    );
    expect(sums.answersPerMonth).toBe(600);
  });

  it("gives the dollar price its lattes and its price per day", () => {
    const sums = pricingSums(getProMonthlyPricing(null).price);

    expect(sums.drinks).toBe(2);
    expect(sums.pricePerDay).toBeCloseTo(
      products.pro.monthlyPrices.USD.amount / 30,
      10
    );
    expect(sums.answersPerDay).toBe(20);
  });
});
