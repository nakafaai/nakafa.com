import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { issueInvoice } from "@repo/backend/confect/billing/invoices";
import {
  createBillingTestConvex,
  exitInMutation,
  runInMutation,
} from "@repo/backend/test/billing";
import { Exit } from "effect";

const NOW = Date.UTC(2026, 9, 24);
const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("billing/invoices", () => {
  it("issues open invoices at the catalog price in the account's currency for the days left, with the next numbers of the year", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert("tenants", {
        country: "ID",
        currency: "IDR",
        kind: "school",
        name: "Sekolah Faktur",
        policies: { emailDomains: [], nina: false, studentThreads: false },
        slug: "sekolah-faktur",
        status: "active",
      });
      const accountId = await ctx.db.insert("billingAccounts", {
        owner: { kind: "tenant", tenantId },
        rail: "xendit",
        country: "ID",
        currency: "IDR",
        providerCustomerId: null,
      });
      const first = await runInMutation(
        ctx,
        issueInvoice({
          accountId,
          billedFrom: 1000,
          buyerTaxId: null,
          dueAt: 5000,
          offer: "school.seat.year",
          periodEnd: 4000,
          periodStart: 1000,
          seats: 300,
        })
      );
      const second = await runInMutation(
        ctx,
        issueInvoice({
          accountId,
          billedFrom: 7 * DAY,
          buyerTaxId: "01.234.567.8-901.000",
          dueAt: 5000,
          offer: "school.seat.year",
          periodEnd: 10 * DAY,
          periodStart: 0,
          seats: 2,
        })
      );
      const stored = await ctx.db.get(first.invoiceId);
      return {
        currency: stored?.currency,
        lineAmount: stored?.lines[0]?.amount,
        numbers: [first.number, second.number],
        secondTotal: second.total,
        status: stored?.status,
        firstTotal: first.total,
      };
    });
    expect(result).toEqual({
      currency: "IDR",
      firstTotal: 30_000_000,
      lineAmount: 30_000_000,
      numbers: ["NKF-2026-000001", "NKF-2026-000002"],
      // Two seats billed for the last 3 of 10 days pay 30% of Rp100.000 each.
      secondTotal: 60_000,
      status: "open",
    });
  });

  it("refuses an offer the account's currency is not priced in", async () => {
    const t = createBillingTestConvex();
    const exit = await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert("tenants", {
        country: "ID",
        currency: "IDR",
        kind: "school",
        name: "Sekolah Tanpa Harga",
        policies: { emailDomains: [], nina: false, studentThreads: false },
        slug: "sekolah-tanpa-harga",
        status: "active",
      });
      const accountId = await ctx.db.insert("billingAccounts", {
        owner: { kind: "tenant", tenantId },
        rail: "xendit",
        country: "ID",
        currency: "IDR",
        providerCustomerId: null,
      });
      const outcome = await exitInMutation(
        ctx,
        issueInvoice({
          accountId,
          billedFrom: 1000,
          buyerTaxId: null,
          dueAt: 5000,
          offer: "school.seat.month",
          periodEnd: 4000,
          periodStart: 1000,
          seats: 1,
        })
      );
      return Exit.isFailure(outcome);
    });
    expect(exit).toBe(true);
  });

  it("refuses an invoice for an account that is gone", async () => {
    const t = createBillingTestConvex();
    const exit = await t.run(async (ctx) => {
      const tenantId = await ctx.db.insert("tenants", {
        country: "ID",
        currency: "IDR",
        kind: "school",
        name: "Sekolah Hilang",
        policies: { emailDomains: [], nina: false, studentThreads: false },
        slug: "sekolah-hilang",
        status: "active",
      });
      const accountId = await ctx.db.insert("billingAccounts", {
        owner: { kind: "tenant", tenantId },
        rail: "xendit",
        country: "ID",
        currency: "IDR",
        providerCustomerId: null,
      });
      await ctx.db.delete(accountId);
      const outcome = await exitInMutation(
        ctx,
        issueInvoice({
          accountId,
          billedFrom: 1000,
          buyerTaxId: null,
          dueAt: 5000,
          offer: "school.seat.year",
          periodEnd: 4000,
          periodStart: 1000,
          seats: 1,
        })
      );
      return Exit.isFailure(outcome);
    });
    expect(exit).toBe(true);
  });
});
