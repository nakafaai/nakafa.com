import { describe, expect, it } from "@effect/vitest";
import {
  type BillingOverview,
  type BillingSubscription,
  formatBillingDate,
  formatCount,
  planStateOf,
  providerNameOf,
  subscribedDescriptionKey,
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
  credits: { allowance: 10, balance: 10, resetAt: Date.UTC(2026, 9, 26) },
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

  it("names the payment provider of each rail", () => {
    expect(providerNameOf("polar")).toBe("Polar");
    expect(providerNameOf("xendit")).toBe("Xendit");
  });

  it("writes a UTC day in the words of the locale, so every zone reads the same day", () => {
    expect(formatBillingDate(Date.UTC(2026, 10, 1, 23, 30), "en")).toBe(
      "November 1, 2026"
    );
    expect(formatBillingDate(Date.UTC(2026, 10, 1), "de")).toBe(
      "1. November 2026"
    );
  });

  it("writes a count in the digits of the locale", () => {
    expect(formatCount(1000, "en")).toBe("1,000");
    expect(formatCount(1000, "id")).toBe("1.000");
  });
});
