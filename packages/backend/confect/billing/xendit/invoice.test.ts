import { describe, expect, it } from "@effect/vitest";
import { invoiceSessionRequest } from "@repo/backend/confect/billing/xendit/invoice";
import { processXenditEvent } from "@repo/backend/confect/billing/xendit/process";
import {
  createBillingTestConvex,
  insertSchool,
  runInMutation,
  xenditDelivery,
} from "@repo/backend/test/billing";

describe("billing/xendit/invoice", () => {
  it("pays an invoice's total in one session named by its number, open until it is due", () => {
    expect(
      invoiceSessionRequest({
        dueAt: Date.UTC(2026, 10, 9, 5, 0, 0),
        number: "NKF-2026-000001",
        total: 43_696,
      })
    ).toStrictEqual({
      amount: 43_696,
      country: "ID",
      currency: "IDR",
      description: "Nakafa School NKF-2026-000001",
      expires_at: "2026-11-09T05:00:00.000Z",
      locale: "id",
      mode: "PAYMENT_LINK",
      reference_id: "NKF-2026-000001",
      session_type: "PAY",
    });
  });

  it("pays the school invoice a completed session was opened for, and takes the link off an open invoice whose session expired", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const tenantId = await insertSchool(ctx);
      const accountId = await ctx.db.insert("billingAccounts", {
        owner: { kind: "tenant", tenantId },
        rail: "xendit",
        country: "ID",
        currency: "IDR",
        providerCustomerId: null,
      });
      const invoice = (number: string) =>
        ctx.db.insert("billingInvoices", {
          accountId,
          number,
          status: "open",
          currency: "IDR",
          lines: [
            {
              description: "school.seat.year",
              quantity: 3,
              unitAmount: 100_000,
              amount: 300_000,
            },
          ],
          total: 300_000,
          periodStart: 0,
          periodEnd: 1_800_000,
          dueAt: 1_800_000,
          paymentLink: `https://dev.xen.to/${number}`,
          buyerTaxId: null,
        });
      const paidId = await invoice("NKF-2026-000001");
      const expiredId = await invoice("NKF-2026-000002");
      const checkout = (sessionId: string, invoiceId: typeof paidId) =>
        ctx.db.insert("billingCheckouts", {
          accountId,
          offer: "school.seat.year",
          rail: "xendit",
          sessionId,
          url: `https://dev.xen.to/${sessionId}`,
          status: "open",
          openedAt: 0,
          expiresAt: 1_800_000,
          locale: "id",
          invoiceId,
        });
      await checkout("ps_1", paidId);
      await checkout("ps_2", expiredId);
      const paid = await runInMutation(
        ctx,
        processXenditEvent(
          xenditDelivery("payment_session.completed", {
            payment_id: "py_invoice",
            payment_session_id: "ps_1",
            reference_id: "NKF-2026-000001",
            session_type: "PAY",
            status: "COMPLETED",
          })
        )
      );
      const expired = await runInMutation(
        ctx,
        processXenditEvent(
          xenditDelivery("payment_session.expired", {
            payment_id: null,
            payment_session_id: "ps_2",
            reference_id: "NKF-2026-000002",
            session_type: "PAY",
            status: "EXPIRED",
          })
        )
      );
      return {
        expired,
        expiredInvoice: await ctx.db.get(expiredId),
        grants: await ctx.db.query("billingGrants").collect(),
        paid,
        paidInvoice: await ctx.db.get(paidId),
        payments: await ctx.db.query("billingPayments").collect(),
      };
    });
    expect(result.paid).toBe("applied");
    expect(result.expired).toBe("applied");
    expect(result.paidInvoice).toMatchObject({
      paymentLink: "https://dev.xen.to/NKF-2026-000001",
      status: "paid",
    });
    expect(result.expiredInvoice).toMatchObject({
      paymentLink: null,
      status: "open",
    });
    expect(result.payments).toMatchObject([
      {
        amount: 300_000,
        kind: "invoice",
        method: "session",
        providerPaymentId: "py_invoice",
      },
    ]);
    expect(result.grants).toMatchObject([
      { product: "school", seats: 3, source: { kind: "invoice" } },
    ]);
  });

  it("keeps the link of an invoice paid before its other session expired", async () => {
    const t = createBillingTestConvex();
    const invoice = await t.run(async (ctx) => {
      const tenantId = await insertSchool(ctx);
      const accountId = await ctx.db.insert("billingAccounts", {
        owner: { kind: "tenant", tenantId },
        rail: "xendit",
        country: "ID",
        currency: "IDR",
        providerCustomerId: null,
      });
      const invoiceId = await ctx.db.insert("billingInvoices", {
        accountId,
        number: "NKF-2026-000003",
        status: "paid",
        currency: "IDR",
        lines: [
          {
            description: "school.seat.year",
            quantity: 1,
            unitAmount: 100_000,
            amount: 100_000,
          },
        ],
        total: 100_000,
        periodStart: 0,
        periodEnd: 1_800_000,
        dueAt: 1_800_000,
        paymentLink: "https://dev.xen.to/paid",
        buyerTaxId: null,
      });
      await ctx.db.insert("billingCheckouts", {
        accountId,
        offer: "school.seat.year",
        rail: "xendit",
        sessionId: "ps_1",
        url: "https://dev.xen.to/ps_1",
        status: "open",
        openedAt: 0,
        expiresAt: 1_800_000,
        locale: "id",
        invoiceId,
      });
      await runInMutation(
        ctx,
        processXenditEvent(
          xenditDelivery("payment_session.expired", {
            payment_id: null,
            payment_session_id: "ps_1",
            reference_id: "NKF-2026-000003",
            session_type: "PAY",
            status: "EXPIRED",
          })
        )
      );
      return await ctx.db.get(invoiceId);
    });
    expect(invoice?.paymentLink).toBe("https://dev.xen.to/paid");
  });
});
