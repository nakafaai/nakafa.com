import { describe, expect, it } from "@effect/vitest";
import {
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
});
