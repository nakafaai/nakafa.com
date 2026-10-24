import { describe, expect, it } from "@effect/vitest";
import { polarBillingState } from "@repo/backend/confect/billing/polar/state";
import { polarSubscriptionRow } from "@repo/backend/test/billing";
import { Array as Arr, Option } from "effect";

/** The mapped state of one row, or null when the row maps to nothing. */
function mapped(overrides: Parameters<typeof polarSubscriptionRow>[0]) {
  return Option.getOrNull(polarBillingState(polarSubscriptionRow(overrides)));
}

describe("billing/polar/state", () => {
  it("maps each Polar status onto the billing lifecycle", () => {
    const statuses = [
      ["active", "active"],
      ["trialing", "active"],
      ["past_due", "pastDue"],
      ["unpaid", "pastDue"],
      ["canceled", "canceled"],
      ["incomplete", "pending"],
      ["incomplete_expired", "ended"],
      ["a status Polar may add later", "pending"],
    ] as const;
    const mappedStatuses = Arr.map(
      statuses,
      ([polar]) => mapped({ status: polar })?.status
    );
    expect(mappedStatuses).toEqual(Arr.map(statuses, ([, billing]) => billing));
  });

  it("ends a canceled subscription once Polar records its end", () => {
    expect(
      mapped({
        endedAt: "2026-10-20T00:00:00.000Z",
        status: "canceled",
      })?.status
    ).toBe("ended");
  });

  it("maps monthly and yearly Pro to their catalog offers and nothing else", () => {
    expect(mapped({ recurringInterval: "month" })?.offer).toBe("pro.monthly");
    expect(mapped({ recurringInterval: "year" })?.offer).toBe("pro.yearly");
    expect(mapped({ recurringInterval: "week" })).toBeNull();
    expect(mapped({ productId: "some-other-product" })).toBeNull();
  });

  it("maps the three catalog currencies and refuses the rest", () => {
    expect(mapped({ currency: "idr" })?.currency).toBe("IDR");
    expect(mapped({ currency: "eur" })?.currency).toBe("EUR");
    expect(mapped({ currency: "usd" })?.currency).toBe("USD");
    expect(mapped({ currency: "gbp" })).toBeNull();
    expect(mapped({ currency: null })).toBeNull();
  });

  it("keeps the period, the provider time, and the price as Polar sent them", () => {
    const state = mapped({
      modifiedAt: "2026-10-15T00:00:00.000Z",
      priceId: "price_idr_month",
    });
    expect(state).toMatchObject({
      currentPeriodEnd: Date.UTC(2026, 10, 1),
      currentPeriodStart: Date.UTC(2026, 9, 1),
      priceId: "price_idr_month",
      providerUpdatedAt: Date.UTC(2026, 9, 15),
    });
    expect(mapped({ currentPeriodEnd: null })?.currentPeriodEnd).toBeNull();
    expect(mapped({ modifiedAt: null })?.providerUpdatedAt).toBe(
      Date.UTC(2026, 9, 1)
    );
    expect(mapped({})?.priceId).toBeNull();
  });
});
