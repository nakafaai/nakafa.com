import { describe, expect, it } from "@effect/vitest";
import {
  type BillingOverview,
  type BillingSubscription,
  creditFooterKey,
  creditPeriodKey,
  formatBillingDate,
  formatCount,
  planStateOf,
  providerNameOf,
  subscribedDescriptionKey,
  usedPercent,
} from "@/lib/billing/plan";

const SUBSCRIPTION: BillingSubscription = {
  cancelAtPeriodEnd: false,
  currentPeriodEnd: Date.UTC(2026, 10, 25),
  currentPeriodStart: Date.UTC(2026, 9, 25),
  offer: "pro.monthly",
  rail: "polar",
  status: "active",
};

const FREE: BillingOverview = {
  credits: {
    allowance: 10,
    balance: 10,
    lots: { balance: 0, expiresAt: null },
    pool: null,
    resetAt: Date.UTC(2026, 9, 26),
  },
  plan: "free",
  subscription: null,
};

describe("billing/plan", () => {
  it("shows the upgrade to a free viewer with no subscription", () => {
    expect(planStateOf(FREE)).toEqual({ kind: "free" });
  });

  it("shows Pro that no subscription on the account bills as granted", () => {
    expect(planStateOf({ ...FREE, plan: "pro" })).toEqual({ kind: "granted" });
  });

  it("shows an active subscription that renews, not ending and not past due", () => {
    expect(
      planStateOf({ ...FREE, plan: "pro", subscription: SUBSCRIPTION })
    ).toEqual({
      kind: "subscribed",
      ending: false,
      pastDue: false,
      subscription: SUBSCRIPTION,
    });
  });

  it("shows a subscription that cancels at the period end as ending", () => {
    const subscription = { ...SUBSCRIPTION, cancelAtPeriodEnd: true };
    expect(planStateOf({ ...FREE, plan: "pro", subscription })).toMatchObject({
      ending: true,
      pastDue: false,
    });
  });

  it("shows a canceled subscription as ending, whatever its cancel flag says", () => {
    const subscription = { ...SUBSCRIPTION, status: "canceled" as const };
    expect(planStateOf({ ...FREE, plan: "pro", subscription })).toMatchObject({
      ending: true,
    });
  });

  it("shows a past-due subscription as past due, so the portal stays in reach", () => {
    const subscription = { ...SUBSCRIPTION, status: "pastDue" as const };
    expect(planStateOf({ ...FREE, plan: "pro", subscription })).toMatchObject({
      ending: false,
      pastDue: true,
    });
  });

  it("keeps a subscription's card when the grant has run out, so the viewer can pay again", () => {
    const subscription = { ...SUBSCRIPTION, status: "pastDue" as const };
    expect(planStateOf({ ...FREE, subscription })).toMatchObject({
      kind: "subscribed",
      pastDue: true,
    });
  });

  it("says in the description what a subscribed plan does now", () => {
    expect(subscribedDescriptionKey({ ending: false, pastDue: false })).toBe(
      "plan-pro-description"
    );
    expect(subscribedDescriptionKey({ ending: true, pastDue: false })).toBe(
      "plan-pro-ending-description"
    );
    expect(subscribedDescriptionKey({ ending: true, pastDue: true })).toBe(
      "plan-pro-past-due-description"
    );
  });

  it("names the credits a viewer spends now: the school's day for a pool member, otherwise the plan's period", () => {
    const member: BillingOverview = {
      ...FREE,
      credits: {
        ...FREE.credits,
        pool: { allowance: 50, balance: 20, resetAt: Date.UTC(2026, 9, 26) },
      },
      plan: "pro",
    };
    expect(creditPeriodKey(FREE)).toBe("credits-today");
    expect(creditPeriodKey({ ...FREE, plan: "pro" })).toBe("credits-month");
    expect(creditPeriodKey(member)).toBe("school-credits");
    expect(creditFooterKey(FREE)).toBe("credits-free-footer");
    expect(creditFooterKey(member)).toBe("school-credits-footer");
  });

  it("names the payment provider of each rail", () => {
    expect(providerNameOf("polar")).toBe("Polar");
    expect(providerNameOf("xendit")).toBe("Xendit");
  });

  it("writes the Jakarta day in the words of the locale, so a late UTC moment reads the next day", () => {
    expect(formatBillingDate(Date.UTC(2026, 10, 1, 23, 30), "en")).toBe(
      "November 2, 2026"
    );
    expect(formatBillingDate(Date.UTC(2026, 9, 31, 16, 59), "de")).toBe(
      "31. Oktober 2026"
    );
  });

  it("writes a count in the digits of the locale", () => {
    expect(formatCount(1000, "en")).toBe("1,000");
    expect(formatCount(1000, "id")).toBe("1.000");
  });

  it("measures the share of the allowance used, in whole percent", () => {
    expect(usedPercent({ allowance: 10, balance: 10 })).toBe(0);
    expect(usedPercent({ allowance: 10, balance: 3 })).toBe(70);
    expect(usedPercent({ allowance: 3, balance: 2 })).toBe(33);
    expect(usedPercent({ allowance: 10, balance: 0 })).toBe(100);
  });

  it("counts a balance above the allowance as nothing used, and a period without an allowance as all used", () => {
    expect(usedPercent({ allowance: 10, balance: 25 })).toBe(0);
    expect(usedPercent({ allowance: 0, balance: 0 })).toBe(100);
  });
});
