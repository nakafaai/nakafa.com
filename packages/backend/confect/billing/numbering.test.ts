import { describe, expect, it } from "@effect/vitest";
import {
  formatInvoiceNumber,
  nextInvoiceNumber,
} from "@repo/backend/confect/billing/numbering";
import {
  createBillingTestConvex,
  runInMutation,
} from "@repo/backend/test/billing";
import { Effect } from "effect";

describe("billing/numbering", () => {
  it("formats invoice numbers with a six digit sequence", () => {
    expect(formatInvoiceNumber(2026, 123)).toBe("NKF-2026-000123");
  });

  it("issues consecutive numbers per year and restarts in a new year", async () => {
    const t = createBillingTestConvex();
    const numbers = await t.mutation(async (ctx) => {
      const first = await runInMutation(ctx, nextInvoiceNumber(2026));
      const second = await runInMutation(ctx, nextInvoiceNumber(2026));
      const nextYear = await runInMutation(ctx, nextInvoiceNumber(2027));
      return [first, second, nextYear];
    });
    expect(numbers).toEqual([
      "NKF-2026-000001",
      "NKF-2026-000002",
      "NKF-2027-000001",
    ]);
  });

  it("continues from a counter row that already exists", async () => {
    const t = createBillingTestConvex();
    const number = await t.run(async (ctx) => {
      await ctx.db.insert("billingCounters", { year: 2026, next: 123 });
      return runInMutation(ctx, nextInvoiceNumber(2026));
    });
    expect(number).toBe("NKF-2026-000123");
  });

  it("refuses to issue a number past six digits", async () => {
    const t = createBillingTestConvex();
    const failure = await t.run(async (ctx) => {
      await ctx.db.insert("billingCounters", { year: 2026, next: 1_000_000 });
      const error = await runInMutation(
        ctx,
        nextInvoiceNumber(2026).pipe(Effect.flip)
      );
      return error._tag;
    });
    expect(failure).toBe("InvoiceNumberExhausted");
  });
});
