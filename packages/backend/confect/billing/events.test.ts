import { describe, expect, it } from "@effect/vitest";
import {
  BILLING_EVENT_RETENTION_MS,
  cleanupEvents,
  markEventProcessed,
  recordEvent,
} from "@repo/backend/confect/billing/events";
import {
  createBillingTestConvex,
  runInMutation,
} from "@repo/backend/test/billing";

const NOW = Date.UTC(2026, 9, 24);
const delivery = {
  key: "recurring.cycle.succeeded:recy_1:2026-10-24",
  payload: '{"event":"recurring.cycle.succeeded"}',
  providerTime: NOW,
  rail: "xendit" as const,
  type: "recurring.cycle.succeeded",
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

  it("marks a stored delivery processed once, keeping its first time", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const { eventId } = await runInMutation(ctx, recordEvent(delivery, NOW));
      await runInMutation(ctx, markEventProcessed(eventId, NOW + 1));
      await runInMutation(ctx, markEventProcessed(eventId, NOW + 2));
      const missing = await ctx.db.insert("billingEvents", {
        key: "gone",
        payload: "{}",
        providerTime: NOW,
        rail: "polar",
        receivedAt: NOW,
        processedAt: null,
        type: "gone",
      });
      await ctx.db.delete(missing);
      await runInMutation(ctx, markEventProcessed(missing, NOW + 3));
      const stored = await ctx.db.get(eventId);
      return stored?.processedAt;
    });
    expect(result).toBe(NOW + 1);
  });

  it("deletes rows received before the retention window and keeps the rest", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const old = NOW - BILLING_EVENT_RETENTION_MS - 1;
      await runInMutation(ctx, recordEvent({ ...delivery, key: "old" }, old));
      await runInMutation(ctx, recordEvent({ ...delivery, key: "fresh" }, NOW));
      const deleted = await runInMutation(ctx, cleanupEvents(NOW));
      const keys = (await ctx.db.query("billingEvents").collect()).map(
        (event) => event.key
      );
      return { deleted, keys };
    });
    expect(result).toEqual({ deleted: 1, keys: ["fresh"] });
  });
});
