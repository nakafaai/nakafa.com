import { describe, expect, it } from "@effect/vitest";
import {
  accountsQuote,
  periodMonths,
  planQuote,
  remainingShare,
  schoolPeriod,
  schoolPeriodPrice,
} from "@repo/backend/confect/billing/quote";
import { SchoolMonths } from "@repo/backend/confect/billing/tier";
import { Array as Arr, Option } from "effect";

const START = Date.UTC(2026, 10, 7);

describe("billing/quote", () => {
  it("prices every period of each plan and account at the owner's rupiah table", () => {
    expect(
      Arr.map(SchoolMonths.literals, (months) => [
        schoolPeriodPrice("pro", months, "IDR"),
        schoolPeriodPrice("max", months, "IDR"),
        schoolPeriodPrice("account", months, "IDR"),
      ])
    ).toStrictEqual([
      [1_790_000, 7_990_000, 15_900],
      [5_370_000, 23_970_000, 47_700],
      [10_417_800, 46_501_800, 92_538],
      [20_406_000, 91_086_000, 181_260],
    ]);
  });

  it("prices the international plans at fixed dollar and euro amounts", () => {
    expect(schoolPeriodPrice("pro", 6, "USD")).toBe(63_438);
    expect(schoolPeriodPrice("max", 12, "EUR")).toBe(568_860);
    expect(schoolPeriodPrice("max", 3, "USD")).toBe(149_700);
  });

  it("bills a plan and its added accounts on one invoice, discounted by the period", () => {
    expect(
      planQuote({ accounts: 1, currency: "IDR", months: 1, plan: "pro" })
    ).toStrictEqual({
      lines: [
        {
          amount: 1_790_000,
          description: "school.pro",
          quantity: 1,
          unitAmount: 1_790_000,
        },
        {
          amount: 15_900,
          description: "school.accounts",
          quantity: 1,
          unitAmount: 15_900,
        },
      ],
      total: 1_805_900,
    });
    expect(
      planQuote({ accounts: 550, currency: "IDR", months: 1, plan: "max" })
        .total
    ).toBe(16_735_000);
  });

  it("bills a plan alone when no account is added", () => {
    expect(
      planQuote({ accounts: 0, currency: "IDR", months: 12, plan: "max" })
    ).toStrictEqual({
      lines: [
        {
          amount: 91_086_000,
          description: "school.max",
          quantity: 1,
          unitAmount: 91_086_000,
        },
      ],
      total: 91_086_000,
    });
  });

  it("rounds a foreign accounts line once on its amount, so the total loses at most a cent", () => {
    // 0.99 × 6 × 0.97 = 5.7618 dollars per account.
    const quote = planQuote({
      accounts: 10,
      currency: "USD",
      months: 6,
      plan: "pro",
    });
    expect(quote.lines[1]).toStrictEqual({
      amount: 5762,
      description: "school.accounts",
      quantity: 10,
      unitAmount: 576,
    });
    expect(quote.total).toBe(63_438 + 5762);
  });

  it("prorates added accounts over the days left in the running plan, at its period's discount", () => {
    const period = schoolPeriod(START, 12);
    // 365 days in the year from 7 Nov 2026; 100 left.
    const from = period.end - 100 * 24 * 60 * 60 * 1000;
    expect(remainingShare(period, from)).toStrictEqual({
      days: 365,
      left: 100,
    });
    expect(
      accountsQuote({ accounts: 10, currency: "IDR", from, period })
    ).toStrictEqual({
      lines: [
        {
          // 181,260 × 100 / 365 = 49,660.27 for one, 496,602.74 for ten.
          amount: 496_603,
          description: "school.accounts",
          quantity: 10,
          unitAmount: 49_660,
        },
      ],
      total: 496_603,
    });
  });

  it("charges the whole period for accounts added before it starts, and nothing for none", () => {
    const period = schoolPeriod(START, 3);
    expect(remainingShare(period, START - 1000)).toStrictEqual({
      days: 92,
      left: 92,
    });
    expect(
      accountsQuote({ accounts: 2, currency: "IDR", from: START, period })
        .total
    ).toBe(95_400);
    expect(
      accountsQuote({ accounts: 0, currency: "IDR", from: START, period })
    ).toStrictEqual({ lines: [], total: 0 });
  });

  it("reads the months of a period back from its dates, and none for another span", () => {
    const period = schoolPeriod(Date.UTC(2027, 0, 31), 1);
    expect(period.end).toBe(Date.UTC(2027, 1, 28));
    expect(periodMonths(period.start, period.end)).toStrictEqual(
      Option.some(1)
    );
    expect(periodMonths(START, START + 1000)).toStrictEqual(Option.none());
  });
});
