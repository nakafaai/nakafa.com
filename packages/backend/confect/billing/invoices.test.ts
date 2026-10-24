import { describe, expect, it } from "@effect/vitest";
import { issueInvoice } from "@repo/backend/confect/billing/invoices";
import {
  createBillingTestConvex,
  runInMutation,
} from "@repo/backend/test/billing";

describe("billing/invoices", () => {
  it("issues an open invoice with computed line amounts and the next number", async () => {
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
          currency: "IDR",
          dueAt: 5000,
          lines: [{ description: "Siswa", quantity: 300, unitAmount: 100_000 }],
          periodEnd: 4000,
          periodStart: 1000,
          year: 2026,
        })
      );
      const second = await runInMutation(
        ctx,
        issueInvoice({
          accountId,
          buyerTaxId: "01.234.567.8-901.000",
          currency: "IDR",
          dueAt: 5000,
          lines: [
            { description: "Siswa", quantity: 2, unitAmount: 10_000 },
            { description: "Tambahan", quantity: 1, unitAmount: 5000 },
          ],
          periodEnd: 4000,
          periodStart: 1000,
          year: 2026,
        })
      );
      const stored = await ctx.db.get(first.invoiceId);
      return {
        numbers: [first.number, second.number],
        firstTotal: first.total,
        secondTotal: second.total,
        status: stored?.status,
        lineAmount: stored?.lines[0]?.amount,
      };
    });
    expect(result).toEqual({
      firstTotal: 30_000_000,
      lineAmount: 30_000_000,
      numbers: ["NKF-2026-000001", "NKF-2026-000002"],
      secondTotal: 25_000,
      status: "open",
    });
  });
});
