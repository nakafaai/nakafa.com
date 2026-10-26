import { beforeEach, describe, expect, it } from "@effect/vitest";
import { XenditRequestFailed } from "@repo/backend/confect/billing/xendit/client";
import { createSession } from "@repo/backend/confect/billing/xendit/sessions";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createBillingTestConvex,
  insertSchool,
} from "@repo/backend/test/billing";
import { DateTime, Effect } from "effect";

vi.mock(
  "@repo/backend/confect/billing/xendit/sessions",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@repo/backend/confect/billing/xendit/sessions")
    >()),
    createSession: vi.fn(),
  })
);

const DUE = Date.UTC(2026, 10, 9, 5, 0, 0);
const steps = internal.billing.xendit.invoice;

/** The answer Xendit gives to Create Session for an invoice, open until it is due. */
function openedSession(paymentLink: string | null) {
  return {
    expires_at: DateTime.makeUnsafe(DUE),
    payment_link_url: paymentLink,
    payment_session_id: "ps-invoice-1",
    recurring_plan_id: null,
    reference_id: "NKF-2026-000001",
    session_type: "PAY" as const,
    status: "ACTIVE" as const,
  };
}

/** Inserts one open invoice of a school, with or without a payment link. */
async function insertInvoice(
  ctx: MutationCtx,
  status: "open" | "paid" = "open",
  paymentLink: string | null = null
) {
  const tenantId = await insertSchool(ctx);
  const accountId = await ctx.db.insert("billingAccounts", {
    owner: { kind: "tenant", tenantId },
    rail: "xendit",
    country: "ID",
    currency: "IDR",
    providerCustomerId: null,
  });
  return await ctx.db.insert("billingInvoices", {
    accountId,
    number: "NKF-2026-000001",
    status,
    currency: "IDR",
    lines: [
      {
        description: "school.seat.year",
        quantity: 2,
        unitAmount: 100_000,
        amount: 200_000,
      },
    ],
    total: 200_000,
    periodStart: 0,
    periodEnd: DUE,
    dueAt: DUE,
    paymentLink,
    buyerTaxId: null,
  });
}

describe("billing/xendit/invoice", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("XENDIT_API_KEY", "test-secret");
    return () => {
      vi.unstubAllEnvs();
    };
  });

  it("opens the hosted payment of an open invoice and lists its link", async () => {
    const t = createBillingTestConvex();
    vi.mocked(createSession).mockReturnValue(
      Effect.succeed(openedSession("https://dev.xen.to/invoice-1"))
    );
    const invoiceId = await t.mutation((ctx) => insertInvoice(ctx));
    await t.action(steps.open, { invoiceId, offer: "school.seat.year" });
    await t.action(steps.open, { invoiceId, offer: "school.seat.year" });
    const result = await t.run(async (ctx) => ({
      checkouts: await ctx.db.query("billingCheckouts").collect(),
      invoice: await ctx.db.get(invoiceId),
    }));
    expect(createSession).toHaveBeenCalledOnce();
    expect(vi.mocked(createSession).mock.calls[0]?.[0]).toMatchObject({
      amount: 200_000,
      reference_id: "NKF-2026-000001",
      session_type: "PAY",
    });
    expect(result.invoice?.paymentLink).toBe("https://dev.xen.to/invoice-1");
    expect(result.checkouts).toMatchObject([
      {
        expiresAt: DUE,
        invoiceId,
        offer: "school.seat.year",
        sessionId: "ps-invoice-1",
        status: "open",
        url: "https://dev.xen.to/invoice-1",
      },
    ]);
  });

  it("opens nothing for a paid invoice", async () => {
    const t = createBillingTestConvex();
    const invoiceId = await t.mutation((ctx) => insertInvoice(ctx, "paid"));
    await t.action(steps.open, { invoiceId, offer: "school.seat.year" });
    expect(createSession).not.toHaveBeenCalled();
  });

  it.each([
    {
      answer: Effect.fail(
        new XenditRequestFailed({
          errorCode: "INVALID_EXPIRY_DATE",
          message: "expires_at is too far away.",
          status: 400,
        })
      ),
      name: "a Xendit failure",
    },
    {
      answer: Effect.succeed(openedSession(null)),
      name: "a session without a link",
    },
  ])("leaves the invoice without a link after $name", async ({ answer }) => {
    const t = createBillingTestConvex();
    vi.mocked(createSession).mockReturnValue(answer);
    const invoiceId = await t.mutation((ctx) => insertInvoice(ctx));
    await t.action(steps.open, { invoiceId, offer: "school.seat.year" });
    const invoice = await t.run((ctx) => ctx.db.get(invoiceId));
    expect(invoice?.paymentLink).toBeNull();
  });
});
