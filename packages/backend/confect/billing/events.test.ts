import { describe, expect, it } from "@effect/vitest";
import {
  applyEvent,
  BILLING_EVENT_RETENTION_MS,
  cleanupEvents,
  recordEvent,
} from "@repo/backend/confect/billing/events";
import {
  PolarCustomerError,
  polarCustomerErrorCode,
} from "@repo/backend/confect/billing/polar/spec";
import { internal } from "@repo/backend/convex/_generated/api";
import {
  createBillingTestConvex,
  exitInMutation,
  insertPolarAccount,
  polarProSubscriptionBody,
  runInMutation,
} from "@repo/backend/test/billing";
import { MASCOT_CODE } from "@repo/backend/test/mascot";
import { Array as Arr, Effect, Exit } from "effect";

const polarGateway = vi.hoisted(() => ({ getCustomer: vi.fn() }));
vi.mock("@repo/backend/confect/billing/polar/live", () => ({ polarGateway }));

const NOW = Date.UTC(2026, 9, 24);
const delivery = {
  key: "recurring.cycle.created:recy_1:SCHEDULED:2026-10-24",
  payload: '{"event":"recurring.cycle.created","data":{}}',
  providerTime: NOW,
  rail: "xendit" as const,
  type: "recurring.cycle.created",
};

describe("billing/events", () => {
  it("stores a delivery once and answers a redelivery with the stored row", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const first = await runInMutation(ctx, recordEvent(delivery, NOW));
      const again = await runInMutation(ctx, recordEvent(delivery, NOW + 5));
      const otherRail = await runInMutation(
        ctx,
        recordEvent({ ...delivery, rail: "polar" }, NOW)
      );
      const stored = await ctx.db.get(first.eventId);
      return {
        firstKind: first.kind,
        againKind: again.kind,
        sameRow: first.eventId === again.eventId,
        otherRailKind: otherRail.kind,
        receivedAt: stored?.receivedAt,
        rows: (await ctx.db.query("billingEvents").collect()).length,
      };
    });
    expect(result).toEqual({
      againKind: "duplicate",
      firstKind: "accepted",
      otherRailKind: "accepted",
      receivedAt: NOW,
      rows: 2,
      sameRow: true,
    });
  });

  it("applies a stored delivery once and keeps its first processed time", async () => {
    const t = createBillingTestConvex();
    const processedAt = await t.run(async (ctx) => {
      const { eventId } = await runInMutation(ctx, recordEvent(delivery, NOW));
      await runInMutation(ctx, applyEvent(eventId, NOW + 1));
      await runInMutation(ctx, applyEvent(eventId, NOW + 2));
      return (await ctx.db.get(eventId))?.processedAt;
    });
    expect(processedAt).toBe(NOW + 1);
  });

  it("refuses to process a row that is gone", async () => {
    const t = createBillingTestConvex();
    const failed = await t.run(async (ctx) => {
      const { eventId } = await runInMutation(ctx, recordEvent(delivery, NOW));
      await ctx.db.delete(eventId);
      const exit = await exitInMutation(ctx, applyEvent(eventId, NOW + 1));
      return Exit.isFailure(exit);
    });
    expect(failed).toBe(true);
  });

  it("marks a delivery it cannot read as processed, so it never blocks the rows behind it", async () => {
    const t = createBillingTestConvex();
    const processedAt = await t.run(async (ctx) => {
      const { eventId } = await runInMutation(
        ctx,
        recordEvent(
          { ...delivery, key: "unreadable", payload: "not json" },
          NOW
        )
      );
      await runInMutation(ctx, applyEvent(eventId, NOW + 1));
      return (await ctx.db.get(eventId))?.processedAt;
    });
    expect(processedAt).toBe(NOW + 1);
  });

  it("marks a Polar row processed even when its body names no event", async () => {
    const t = createBillingTestConvex();
    const processedAt = await t.run(async (ctx) => {
      const { eventId } = await runInMutation(
        ctx,
        recordEvent(
          { ...delivery, key: "polar-row", rail: "polar", payload: "{}" },
          NOW
        )
      );
      await runInMutation(ctx, applyEvent(eventId, NOW + 1));
      return (await ctx.db.get(eventId))?.processedAt;
    });
    expect(processedAt).toBe(NOW + 1);
  });

  it("deletes processed rows past the retention window and keeps the fresh and unprocessed ones", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const old = NOW - BILLING_EVENT_RETENTION_MS - 1;
      const done = await runInMutation(
        ctx,
        recordEvent({ ...delivery, key: "old-done" }, old)
      );
      await runInMutation(ctx, applyEvent(done.eventId, old));
      await runInMutation(
        ctx,
        recordEvent({ ...delivery, key: "old-open" }, old)
      );
      await runInMutation(ctx, recordEvent({ ...delivery, key: "fresh" }, NOW));
      const deleted = await runInMutation(ctx, cleanupEvents(NOW));
      const keys = Arr.map(
        await ctx.db.query("billingEvents").collect(),
        (event) => event.key
      );
      return { deleted, keys };
    });
    expect(result.deleted).toBe(1);
    expect(result.keys).toHaveLength(2);
    expect(result.keys).toContain("old-open");
    expect(result.keys).toContain("fresh");
  });

  it("leaves a Polar delivery that names a customer with no account unprocessed, and returns that customer", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const { eventId } = await runInMutation(
        ctx,
        recordEvent(
          {
            ...delivery,
            key: "unknown-customer",
            payload: polarProSubscriptionBody("cust_event_unknown"),
            rail: "polar",
            type: "subscription.created",
          },
          NOW
        )
      );
      const outcome = await runInMutation(ctx, applyEvent(eventId, NOW + 1));
      return { outcome, processedAt: (await ctx.db.get(eventId))?.processedAt };
    });
    expect(result).toEqual({
      outcome: { customerId: "cust_event_unknown", kind: "unknownCustomer" },
      processedAt: null,
    });
  });

  it("applies a Polar delivery whose customer is linked, without asking Polar", async () => {
    polarGateway.getCustomer.mockReset();
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "auth-event-linked",
        credits: 0,
        creditsResetAt: NOW,
        email: "event-linked@example.com",
        mascot: MASCOT_CODE,
        name: "Event Linked",
        plan: "free",
      });
      await insertPolarAccount(ctx, userId, "cust_event_linked");
      const { eventId } = await runInMutation(
        ctx,
        recordEvent(
          {
            ...delivery,
            key: "linked-customer",
            payload: polarProSubscriptionBody("cust_event_linked"),
            rail: "polar",
            type: "subscription.created",
          },
          NOW
        )
      );
      const outcome = await runInMutation(ctx, applyEvent(eventId, NOW + 1));
      return { outcome, processedAt: (await ctx.db.get(eventId))?.processedAt };
    });
    expect(result).toEqual({
      outcome: { kind: "processed" },
      processedAt: NOW + 1,
    });
    expect(polarGateway.getCustomer).not.toHaveBeenCalled();
  });

  it("links an unknown Polar customer to the user its external ID names, then applies the delivery", async () => {
    polarGateway.getCustomer.mockReset();
    polarGateway.getCustomer.mockReturnValue(
      Effect.succeed(
        polarCustomerFixture("cust_event_link", "auth-event-link", "ID")
      )
    );
    const t = createBillingTestConvex();
    const eventId = await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: "auth-event-link",
        credits: 0,
        creditsResetAt: NOW,
        email: "event-link@example.com",
        mascot: MASCOT_CODE,
        name: "Event Link",
        plan: "free",
      });
      const recorded = await runInMutation(
        ctx,
        recordEvent(
          {
            ...delivery,
            key: "resolve-customer",
            payload: polarProSubscriptionBody("cust_event_link"),
            rail: "polar",
            type: "subscription.created",
          },
          NOW
        )
      );
      return recorded.eventId;
    });
    await t.action(internal.billing.events.process, { eventId });
    const stored = await t.run(async (ctx) => ({
      accounts: await ctx.db.query("billingAccounts").collect(),
      processedAt: (await ctx.db.get(eventId))?.processedAt,
      subscriptions: await ctx.db.query("billingSubscriptions").collect(),
    }));
    expect(stored.accounts).toMatchObject([
      { country: "ID", currency: "IDR", providerCustomerId: "cust_event_link" },
    ]);
    expect(stored.subscriptions).toHaveLength(1);
    expect(stored.processedAt).not.toBeNull();
  });

  it.each([
    [
      "the customer matches no user",
      polarCustomerFixture("cust_nobody_event", "auth-nobody-event", null),
    ],
    [
      "the customer has no external ID",
      polarCustomerFixture("cust_no_ext_event", null, null),
    ],
  ])("leaves a delivery unprocessed when %s", async (_label, customer) => {
    polarGateway.getCustomer.mockReset();
    polarGateway.getCustomer.mockReturnValue(Effect.succeed(customer));
    const t = createBillingTestConvex();
    const eventId = await t.run(async (ctx) => {
      const recorded = await runInMutation(
        ctx,
        recordEvent(
          {
            ...delivery,
            key: `unresolved-${customer.id}`,
            payload: polarProSubscriptionBody(customer.id),
            rail: "polar",
            type: "subscription.created",
          },
          NOW
        )
      );
      return recorded.eventId;
    });
    await t.action(internal.billing.events.process, { eventId });
    expect(
      await t.run(async (ctx) => (await ctx.db.get(eventId))?.processedAt)
    ).toBeNull();
    expect(
      await t.run((ctx) => ctx.db.query("billingAccounts").collect())
    ).toEqual([]);
  });

  it("leaves a delivery unprocessed when Polar cannot read its customer", async () => {
    polarGateway.getCustomer.mockReset();
    polarGateway.getCustomer.mockReturnValue(
      Effect.fail(
        new PolarCustomerError({
          code: polarCustomerErrorCode,
          message: "Failed to load Polar customer.",
        })
      )
    );
    const t = createBillingTestConvex();
    const eventId = await t.run(async (ctx) => {
      const recorded = await runInMutation(
        ctx,
        recordEvent(
          {
            ...delivery,
            key: "unreadable-customer",
            payload: polarProSubscriptionBody("cust_unreadable"),
            rail: "polar",
            type: "subscription.created",
          },
          NOW
        )
      );
      return recorded.eventId;
    });
    await t.action(internal.billing.events.process, { eventId });
    expect(
      await t.run(async (ctx) => (await ctx.db.get(eventId))?.processedAt)
    ).toBeNull();
  });
});

/** A Polar customer as the resolver reads it: its ID, the Nakafa auth ID it names, and its billing country. */
function polarCustomerFixture(
  id: string,
  externalId: string | null,
  billingCountry: string | null
) {
  return {
    billingCountry,
    email: null,
    externalId,
    id,
    name: null,
  };
}
