import { describe, expect, it } from "@effect/vitest";
import { recordPayment } from "@repo/backend/confect/billing/payments";
import {
  createBillingTestConvex,
  runInMutation,
} from "@repo/backend/test/billing";
import { MASCOT_CODE } from "@repo/backend/test/mascot";

describe("billing/payments", () => {
  it("records a payment once per rail and provider payment ID", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "auth-billing-payment",
        credits: 0,
        creditsResetAt: 0,
        email: "billing-payment@example.com",
        mascot: MASCOT_CODE,
        name: "Billing Payment",
        plan: "free",
      });
      const accountId = await ctx.db.insert("billingAccounts", {
        owner: { kind: "personal", userId },
        rail: "xendit",
        country: "ID",
        currency: "IDR",
        providerCustomerId: null,
      });
      const payment = {
        accountId,
        amount: 79_000,
        currency: "IDR" as const,
        kind: "pass" as const,
        method: "QRIS",
        paidAt: 1000,
        providerPaymentId: "py_1",
        providerUpdatedAt: 1000,
        rail: "xendit" as const,
        status: "succeeded" as const,
      };
      const first = await runInMutation(ctx, recordPayment(payment));
      const replay = await runInMutation(ctx, recordPayment(payment));
      const other = await runInMutation(
        ctx,
        recordPayment({ ...payment, providerPaymentId: "py_2" })
      );
      return {
        firstKind: first.kind,
        replayKind: replay.kind,
        sameRow: first.paymentId === replay.paymentId,
        otherKind: other.kind,
        rows: (await ctx.db.query("billingPayments").collect()).length,
      };
    });
    expect(result).toEqual({
      firstKind: "recorded",
      otherKind: "recorded",
      replayKind: "duplicate",
      rows: 2,
      sameRow: true,
    });
  });

  it("moves a stored payment to a newer provider state and keeps the time the money arrived", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "auth-billing-payment-state",
        credits: 0,
        creditsResetAt: 0,
        email: "billing-payment-state@example.com",
        mascot: MASCOT_CODE,
        name: "Billing Payment State",
        plan: "free",
      });
      const accountId = await ctx.db.insert("billingAccounts", {
        owner: { kind: "personal", userId },
        rail: "xendit",
        country: "ID",
        currency: "IDR",
        providerCustomerId: null,
      });
      const payment = {
        accountId,
        amount: 79_000,
        currency: "IDR" as const,
        kind: "pass" as const,
        method: "QRIS",
        paidAt: 1000,
        providerPaymentId: "py_state",
        providerUpdatedAt: 1000,
        rail: "xendit" as const,
        status: "succeeded" as const,
      };
      const first = await runInMutation(ctx, recordPayment(payment));
      const refund = await runInMutation(
        ctx,
        recordPayment({
          ...payment,
          paidAt: 2000,
          providerUpdatedAt: 2000,
          status: "refunded",
        })
      );
      const older = await runInMutation(
        ctx,
        recordPayment({
          ...payment,
          providerUpdatedAt: 1500,
          status: "failed",
        })
      );
      const stored = await ctx.db.get(first.paymentId);
      return {
        refundKind: refund.kind,
        olderKind: older.kind,
        status: stored?.status,
        paidAt: stored?.paidAt,
        providerUpdatedAt: stored?.providerUpdatedAt,
      };
    });
    expect(result).toEqual({
      olderKind: "duplicate",
      paidAt: 1000,
      providerUpdatedAt: 2000,
      refundKind: "updated",
      status: "refunded",
    });
  });
});
