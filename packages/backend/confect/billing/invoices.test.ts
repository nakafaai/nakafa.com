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
  it("issues open invoices of the given lines in the account's currency, with the next numbers of the year", async () => {
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
          buyerTaxId: null,
          dueAt: 5000,
          lines: [
            {
              amount: 7_990_000,
              description: "school.max",
              quantity: 1,
              unitAmount: 7_990_000,
            },
          ],
          periodEnd: 4000,
          periodStart: 1000,
          total: 7_990_000,
        })
      );
      const second = await runInMutation(
        ctx,
        issueInvoice({
          accountId,
          buyerTaxId: "01.234.567.8-901.000",
          dueAt: 5000,
          lines: [
            {
              amount: 31_800,
              description: "school.accounts",
              quantity: 2,
              unitAmount: 15_900,
            },
          ],
          periodEnd: 10 * DAY,
          periodStart: 7 * DAY,
          total: 31_800,
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
      firstTotal: 7_990_000,
      lineAmount: 7_990_000,
      numbers: ["NKF-2026-000001", "NKF-2026-000002"],
      secondTotal: 31_800,
      status: "open",
    });
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
          buyerTaxId: null,
          dueAt: 5000,
          lines: [
            {
              amount: 15_900,
              description: "school.accounts",
              quantity: 1,
              unitAmount: 15_900,
            },
          ],
          periodEnd: 4000,
          periodStart: 1000,
          total: 15_900,
        })
      );
      return Exit.isFailure(outcome);
    });
    expect(exit).toBe(true);
  });
});
