import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import {
  formatInvoiceNumber,
  nextInvoiceNumber,
} from "@repo/backend/confect/billing/numbering";
import {
  createBillingTestConvex,
  exitInMutation,
  runInMutation,
} from "@repo/backend/test/billing";
import { Exit } from "effect";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.UTC(2026, 9, 24));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("billing/numbering", () => {
  it("formats a sequence as six digits of its year", () => {
    expect(formatInvoiceNumber(2026, 123)).toBe("NKF-2026-000123");
  });

  it("issues consecutive numbers per year, and the count restarts in a new year", async () => {
    const t = createBillingTestConvex();
    const numbers = await t.run(async (ctx) => [
      await runInMutation(ctx, nextInvoiceNumber()),
      await runInMutation(ctx, nextInvoiceNumber()),
    ]);
    expect(numbers).toEqual(["NKF-2026-000001", "NKF-2026-000002"]);
    vi.setSystemTime(Date.UTC(2027, 0, 1));
    const next = await t.run((ctx) => runInMutation(ctx, nextInvoiceNumber()));
    expect(next).toBe("NKF-2027-000001");
  });

  it("refuses a number once the year's six-digit sequence is used up", async () => {
    const t = createBillingTestConvex();
    const failed = await t.run(async (ctx) => {
      await ctx.db.insert("billingCounters", { year: 2026, next: 1_000_000 });
      const exit = await exitInMutation(ctx, nextInvoiceNumber());
      return Exit.isFailure(exit);
    });
    expect(failed).toBe(true);
  });
});
