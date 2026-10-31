import { describe, expect, it } from "@effect/vitest";
import { schoolInvoice } from "@repo/backend/confect/billing/receipts";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/confect/test.helpers";
import { api, internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";

const NOW = Date.UTC(2026, 9, 31, 17, 0, 0);

/** One learner with a Xendit account and a paid credit pack on it. */
async function seedPaidPack(ctx: MutationCtx, suffix: string) {
  const user = await seedAuthenticatedUser(ctx, { now: NOW, suffix });
  const accountId = await ctx.db.insert("billingAccounts", {
    country: "ID",
    currency: "IDR",
    owner: { kind: "personal", userId: user.userId },
    providerCustomerId: null,
    rail: "xendit",
  });
  const paymentId = await ctx.db.insert("billingPayments", {
    accountId,
    amount: 59_000,
    currency: "IDR",
    kind: "credits",
    method: "order",
    paidAt: NOW,
    providerPaymentId: `py_${suffix}`,
    providerUpdatedAt: NOW,
    rail: "xendit",
    status: "succeeded",
  });
  return { ...user, accountId, paymentId };
}

describe("billing/receipts", () => {
  it("reads the invoice of the learner's own paid Xendit payment", async () => {
    const t = createConvexTestWithBetterAuth();
    const invoice = await t.mutation(async (ctx) => {
      const { paymentId, userId } = await seedPaidPack(ctx, "own");
      return ctx.runQuery(internal.billing.receipts.read, {
        locale: "id",
        paymentId,
        userId,
      });
    });
    expect(invoice).toMatchObject({
      dueOn: null,
      issuedOn: "1 November 2026",
      lines: [{ description: "1.000 kredit Nina" }],
      number: "py_own",
      paidWith: "Xendit",
      status: "paid",
    });
    expect(invoice?.total).toContain("59.000");
  });

  it("gives no invoice for another learner's, a Polar, a refunded, or a missing payment", async () => {
    const t = createConvexTestWithBetterAuth();
    const result = await t.mutation(async (ctx) => {
      const owner = await seedPaidPack(ctx, "owner");
      const other = await seedPaidPack(ctx, "other");
      const read = (paymentId: typeof owner.paymentId) =>
        ctx.runQuery(internal.billing.receipts.read, {
          locale: "en",
          paymentId,
          userId: other.userId,
        });
      const foreign = await read(owner.paymentId);
      await ctx.db.patch(other.paymentId, { status: "refunded" });
      const refunded = await read(other.paymentId);
      await ctx.db.patch(other.paymentId, {
        rail: "polar",
        status: "succeeded",
      });
      const polar = await read(other.paymentId);
      await ctx.db.delete(other.paymentId);
      const missing = await read(other.paymentId);
      return { foreign, missing, polar, refunded };
    });
    expect(result).toEqual({
      foreign: null,
      missing: null,
      polar: null,
      refunded: null,
    });
  });

  it("writes a school's invoice with its number, its lines, and a due date while it is open", () => {
    const invoice = {
      _creationTime: NOW,
      currency: "IDR",
      dueAt: NOW + 86_400_000,
      lines: [
        {
          amount: 20_218,
          description: "school.seat.semester",
          quantity: 1,
          unitAmount: 20_218,
        },
      ],
      number: "NKF-2026-000001",
      status: "open",
      total: 20_218,
    } as const;
    expect(schoolInvoice(invoice, "SMA Harapan", "en")).toMatchObject({
      buyer: { email: null, name: "SMA Harapan" },
      dueOn: "November 2, 2026",
      lines: [{ description: "Nakafa School, one semester" }],
      number: "NKF-2026-000001",
      paidWith: null,
      status: "open",
    });
    expect(
      schoolInvoice({ ...invoice, status: "paid" }, "SMA Harapan", "id")
    ).toMatchObject({ dueOn: null, paidWith: "Xendit", status: "paid" });
    expect(
      schoolInvoice({ ...invoice, status: "draft" }, "SMA Harapan", "id").status
    ).toBe("open");
    expect(
      schoolInvoice(
        {
          ...invoice,
          lines: [{ ...invoice.lines[0], description: "Licence, 2026" }],
        },
        "SMA Harapan",
        "id"
      ).lines
    ).toMatchObject([{ description: "Licence, 2026" }]);
  });

  it("downloads the learner's invoice as a PDF, and refuses another's", async () => {
    const t = createConvexTestWithBetterAuth();
    const { owner, other } = await t.mutation(async (ctx) => ({
      other: await seedPaidPack(ctx, "stranger"),
      owner: await seedPaidPack(ctx, "buyer"),
    }));
    const authed = t.withIdentity({
      sessionId: owner.sessionId,
      subject: owner.authUserId,
    });
    const file = await authed.action(api.billing.receipts.download, {
      locale: "de",
      paymentId: owner.paymentId,
    });
    expect(file.name).toBe("nakafa-invoice-py_buyer.pdf");
    expect(file.base64.startsWith("JVBERi0")).toBe(true);
    await expect(
      authed.action(api.billing.receipts.download, {
        locale: "de",
        paymentId: other.paymentId,
      })
    ).rejects.toThrow("BILLING_RECEIPT_UNAVAILABLE");
  });
});
