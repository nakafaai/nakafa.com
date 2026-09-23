import { describe, expect, it } from "@effect/vitest";
import { RecurringInterval$inboundSchema } from "@polar-sh/sdk/models/components/recurringinterval";
import { convertToDatabaseSubscription } from "@repo/backend/convex/subscriptions/utils";
import {
  polarSubscription as subscription,
  polarTimestamp as timestamp,
} from "@repo/backend/test/polar";

describe("Polar subscription persistence", () => {
  it("serializes dates and preserves nullable billing state without inventing a school", () => {
    expect(convertToDatabaseSubscription(subscription)).toStrictEqual({
      amount: 1000,
      cancelAtPeriodEnd: false,
      checkoutId: null,
      createdAt: timestamp.toISOString(),
      currency: "usd",
      currentPeriodEnd: timestamp.toISOString(),
      currentPeriodStart: timestamp.toISOString(),
      customerCancellationComment: null,
      customerCancellationReason: null,
      customerId: "customer",
      endedAt: null,
      id: "subscription",
      metadata: {},
      modifiedAt: null,
      productId: "product",
      recurringInterval: "month",
      startedAt: null,
      status: "active",
    });
  });

  it("retains school identity and populated lifecycle timestamps", () => {
    const stored = convertToDatabaseSubscription({
      ...subscription,
      endedAt: timestamp,
      metadata: { schoolId: "school" },
      modifiedAt: timestamp,
      startedAt: timestamp,
    });
    expect(stored).toMatchObject({
      endedAt: timestamp.toISOString(),
      modifiedAt: timestamp.toISOString(),
      schoolId: "school",
      startedAt: timestamp.toISOString(),
    });
  });

  it.each(["", 123, false])("omits invalid school metadata %s", (schoolId) => {
    expect(
      convertToDatabaseSubscription({ ...subscription, metadata: { schoolId } })
    ).not.toHaveProperty("schoolId");
  });

  it.each(["", "unknown-interval"])(
    "normalizes an unsupported SDK interval %s",
    (recurringInterval) => {
      expect(
        convertToDatabaseSubscription({
          ...subscription,
          recurringInterval:
            RecurringInterval$inboundSchema.parse(recurringInterval),
        }).recurringInterval
      ).toBeNull();
    }
  );
});
