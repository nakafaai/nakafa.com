import { describe, expect, it } from "@effect/vitest";
import {
  creditsCharged,
  creditsForCost,
  freeDailyBudgetCredits,
  getPlanCreditConfig,
} from "@repo/backend/confect/credits/constants";

describe("credits/constants", () => {
  it("grants the free and Pro allowances the pricing strategy sets", () => {
    expect(getPlanCreditConfig("free")).toEqual({
      amount: 10,
      grantType: "daily-grant",
    });
    expect(getPlanCreditConfig("pro")).toEqual({
      amount: 1000,
      grantType: "monthly-grant",
    });
  });

  it("charges a credit per two-tenths of a cent, rounded up, at least one and at most fifty", () => {
    expect(creditsForCost(0)).toBe(1);
    expect(creditsForCost(0.0094)).toBe(5);
    expect(creditsForCost(0.002)).toBe(1);
    expect(creditsForCost(0.1)).toBe(50);
    expect(creditsForCost(0.34)).toBe(50);
  });

  it("shares five percent of last month's net revenue over thirty days as free credits", () => {
    expect(freeDailyBudgetCredits(0)).toBe(0);
    expect(freeDailyBudgetCredits(1000)).toBe(833);
  });

  it("prices a summed float cost by whole micro-dollars, so a float never rounds up a credit", () => {
    expect(creditsForCost(0.1 * 0.42)).toBe(21);
  });

  it("charges an answer its priced cost, never more than its hold", () => {
    expect(creditsCharged([{ cost: 0.0094 }, { cost: 0.0006 }], 50)).toBe(5);
    expect(creditsCharged([{ cost: 0.34 }], 10)).toBe(10);
  });

  it("charges the whole hold when a call reports no cost, and the least credit for an answer with no call", () => {
    expect(creditsCharged([{ cost: 0.0094 }, {}], 50)).toBe(50);
    expect(creditsCharged([], 5)).toBe(1);
  });
});
