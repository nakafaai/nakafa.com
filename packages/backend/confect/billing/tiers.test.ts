import { describe, expect, it } from "@effect/vitest";
import {
  cheapestSchoolTier,
  schoolMonthlyAfterDiscount,
  schoolPeriodTotal,
  schoolQuote,
  schoolTiers,
} from "@repo/backend/confect/billing/tiers";

describe("billing/tiers", () => {
  it("bills each period of the report's rupiah table", () => {
    expect(schoolPeriodTotal(schoolTiers.pro.monthly.IDR, 3)).toBe(5_370_000);
    expect(schoolPeriodTotal(schoolTiers.pro.monthly.IDR, 6)).toBe(10_417_800);
    expect(schoolPeriodTotal(schoolTiers.max.monthly.IDR, 6)).toBe(46_501_800);
    expect(schoolPeriodTotal(schoolTiers.max.monthly.IDR, 12)).toBe(91_086_000);
    expect(schoolPeriodTotal(15_900, 6)).toBe(92_538);
    expect(schoolPeriodTotal(15_900, 12)).toBe(181_260);
  });

  it("bills each period of the report's dollar table in cents", () => {
    expect(schoolPeriodTotal(schoolTiers.pro.monthly.USD, 6)).toBe(63_438);
    expect(schoolPeriodTotal(schoolTiers.pro.monthly.USD, 12)).toBe(124_260);
    expect(schoolPeriodTotal(schoolTiers.max.monthly.EUR, 6)).toBe(290_418);
    expect(schoolPeriodTotal(schoolTiers.max.monthly.EUR, 12)).toBe(568_860);
  });

  it("rounds a discounted cent amount to the nearest cent", () => {
    expect(schoolPeriodTotal(99, 6)).toBe(576);
    expect(schoolMonthlyAfterDiscount(99, 6)).toBe(96);
    expect(schoolMonthlyAfterDiscount(schoolTiers.pro.monthly.IDR, 12)).toBe(
      1_700_500
    );
  });

  it("adds accounts with their credits and storage to a paid plan", () => {
    expect(
      schoolQuote({ added: 1, currency: "IDR", period: 1, tier: "pro" })
    ).toStrictEqual({
      accounts: 101,
      credits: 606,
      monthly: 1_805_900,
      monthlyAfterDiscount: 1_805_900,
      storageMegabytes: 10_200,
      total: 1_805_900,
    });
    expect(
      schoolQuote({ added: 550, currency: "IDR", period: 1, tier: "max" })
        .monthly
    ).toBe(16_735_000);
  });

  it("picks the plan that holds a number of accounts for less", () => {
    expect(cheapestSchoolTier(1050, "IDR")).toStrictEqual({
      added: 550,
      monthly: 16_735_000,
      tier: "max",
    });
    expect(cheapestSchoolTier(80, "USD")).toStrictEqual({
      added: 0,
      monthly: 10_900,
      tier: "pro",
    });
  });
});
