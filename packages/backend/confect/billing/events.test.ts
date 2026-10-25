import { describe, expect, it } from "@effect/vitest";
import {
  BILLING_EVENT_RETENTION_MS,
  cleanupEvents,
  processEvent,
  recordEvent,
} from "@repo/backend/confect/billing/events";
import {
  createBillingTestConvex,
  exitInMutation,
  runInMutation,
} from "@repo/backend/test/billing";
import { Array as Arr, Exit } from "effect";

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
      await runInMutation(ctx, processEvent(eventId, NOW + 1));
      await runInMutation(ctx, processEvent(eventId, NOW + 2));
      return (await ctx.db.get(eventId))?.processedAt;
    });
    expect(processedAt).toBe(NOW + 1);
  });

  it("refuses to process a row that is gone", async () => {
    const t = createBillingTestConvex();
    const failed = await t.run(async (ctx) => {
      const { eventId } = await runInMutation(ctx, recordEvent(delivery, NOW));
      await ctx.db.delete(eventId);
      const exit = await exitInMutation(ctx, processEvent(eventId, NOW + 1));
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
      await runInMutation(ctx, processEvent(eventId, NOW + 1));
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
      await runInMutation(ctx, processEvent(eventId, NOW + 1));
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
      await runInMutation(ctx, processEvent(done.eventId, old));
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
});
