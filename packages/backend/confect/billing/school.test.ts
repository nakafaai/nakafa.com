import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  type SchoolOrder,
  schoolPeriod,
} from "@repo/backend/confect/billing/quote";
import {
  applyInvoicePaid,
  ensureSchoolAccount,
  issueSchoolInvoice,
  schoolRail,
} from "@repo/backend/confect/billing/school";
import { systemActor } from "@repo/backend/confect/tenancy/actor";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createBillingTestConvex,
  exitInMutation,
  insertSchool,
  runInMutation,
} from "@repo/backend/test/billing";
import { MASCOT_CODE } from "@repo/backend/test/mascot";
import { Cause, Effect, Exit } from "effect";

/** 26 Oct 2026, 12:00 in Jakarta. */
const NOW = Date.UTC(2026, 9, 26, 5, 0, 0);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

/** The school as Confect reads it, with its slug decoded, for the billing programs that take one. */
const readTenant = (tenantId: Id<"tenants">) =>
  Effect.flatMap(DatabaseReader, (reader) =>
    reader.table("tenants").get(tenantId).pipe(Effect.orDie)
  );

/** The journal entries of one change type that a school holds. */
function journalOf(
  ctx: MutationCtx,
  tenantId: Id<"tenants">,
  type: "billing.invoice.issued" | "billing.invoice.paid"
) {
  return ctx.db
    .query("journalEntries")
    .withIndex("by_owner_tenantId_and_change_type", (query) =>
      query.eq("owner.tenantId", tenantId).eq("change.type", type)
    )
    .collect();
}

describe("billing/school accounts", () => {
  it("bills an Indonesian school through Xendit in rupiah and any other school through Polar", async () => {
    expect(schoolRail("ID")).toBe("xendit");
    expect(schoolRail("DE")).toBe("polar");
    const t = createBillingTestConvex();
    const accounts = await t.run(async (ctx) => {
      const indonesian = await insertSchool(ctx);
      const german = await ctx.db.insert("tenants", {
        country: "DE",
        currency: "EUR",
        kind: "school",
        name: "Schule Test",
        policies: { emailDomains: [], nina: false, studentThreads: false },
        slug: "schule-test",
        status: "active",
      });
      for (const tenantId of [indonesian, german]) {
        await runInMutation(
          ctx,
          Effect.flatMap(readTenant(tenantId), ensureSchoolAccount)
        );
      }
      return await ctx.db.query("billingAccounts").collect();
    });
    expect(accounts).toMatchObject([
      { country: "ID", currency: "IDR", rail: "xendit" },
      { country: "DE", currency: "EUR", rail: "polar" },
    ]);
  });
});

/** Issues one order's invoice for a school, as its billing page asks for it. */
const issueOrder = (tenantId: Id<"tenants">, order: SchoolOrder) =>
  Effect.flatMap(readTenant(tenantId), (tenant) =>
    issueSchoolInvoice(systemActor, tenant, order)
  );

/** Pays one invoice by transfer at `paidAt`. */
const payInvoice = (invoiceId: Id<"billingInvoices">, paidAt = NOW) =>
  applyInvoicePaid(systemActor, invoiceId, {
    method: "transfer",
    paidAt,
    providerPaymentId: `BCA-${invoiceId}`,
  });

const DAY = 24 * 60 * 60 * 1000;

describe("billing/school invoices", () => {
  it("bills a plan with its added accounts for a whole period from now, and returns the open invoice to a second order", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const tenantId = await insertSchool(ctx);
      const first = await runInMutation(
        ctx,
        issueOrder(tenantId, {
          kind: "plan",
          accounts: 1,
          months: 6,
          plan: "pro",
        })
      );
      const again = await runInMutation(
        ctx,
        issueOrder(tenantId, {
          kind: "plan",
          accounts: 0,
          months: 1,
          plan: "max",
        })
      );
      return {
        again: again.number,
        first: first.number,
        invoices: await ctx.db.query("billingInvoices").collect(),
        journal: await journalOf(ctx, tenantId, "billing.invoice.issued"),
      };
    });
    const period = schoolPeriod(NOW, 6);
    expect(result.again).toBe(result.first);
    expect(result.invoices).toMatchObject([
      {
        currency: "IDR",
        lines: [
          { description: "school.pro", quantity: 1, amount: 10_417_800 },
          { description: "school.accounts", quantity: 1, amount: 92_538 },
        ],
        total: 10_510_338,
        number: "NKF-2026-000001",
        periodStart: period.start,
        periodEnd: period.end,
        dueAt: NOW + 14 * DAY,
        status: "open",
      },
    ]);
    expect(result.journal).toMatchObject([
      {
        change: {
          currency: "IDR",
          number: "NKF-2026-000001",
          total: 10_510_338,
          type: "billing.invoice.issued",
        },
      },
    ]);
  });

  it("starts a renewal when the running plan ends, and prorates added accounts to that end", async () => {
    const t = createBillingTestConvex();
    const year = schoolPeriod(NOW, 12);
    const tenantId = await t.run(async (ctx) => {
      const school = await insertSchool(ctx);
      const plan = await runInMutation(
        ctx,
        issueOrder(school, {
          kind: "plan",
          accounts: 0,
          months: 12,
          plan: "max",
        })
      );
      await runInMutation(ctx, payInvoice(plan.invoiceId));
      return school;
    });
    // A transaction reads one moment, so the later orders run in transactions of their own.
    vi.setSystemTime(year.end - 100 * DAY);
    const result = await t.run(async (ctx) => {
      const more = await runInMutation(
        ctx,
        issueOrder(tenantId, { kind: "accounts", accounts: 10 })
      );
      await runInMutation(
        ctx,
        payInvoice(more.invoiceId, year.end - 100 * DAY)
      );
      const renewal = await runInMutation(
        ctx,
        issueOrder(tenantId, {
          kind: "plan",
          accounts: 10,
          months: 1,
          plan: "max",
        })
      );
      return {
        grants: await ctx.db.query("billingGrants").collect(),
        more: await ctx.db.get(more.invoiceId),
        renewal: await ctx.db.get(renewal.invoiceId),
      };
    });
    expect(result.more).toMatchObject({
      // 181,260 × 10 accounts × 100 of the year's 365 days.
      lines: [
        { description: "school.accounts", quantity: 10, amount: 496_603 },
      ],
      periodEnd: year.end,
      periodStart: year.end - 100 * DAY,
    });
    expect(result.grants).toMatchObject([
      { seats: 500, validFrom: year.start, validTo: year.end },
      { seats: 10, validFrom: year.end - 100 * DAY, validTo: year.end },
    ]);
    expect(result.renewal).toMatchObject({
      lines: [
        { description: "school.max", amount: 7_990_000 },
        { description: "school.accounts", quantity: 10, amount: 159_000 },
      ],
      periodStart: year.end,
      periodEnd: schoolPeriod(year.end, 1).end,
    });
  });

  it("refuses more accounts while no paid plan runs, a contract included", async () => {
    const t = createBillingTestConvex();
    const failure = await t.run(async (ctx) => {
      const tenantId = await insertSchool(ctx);
      await ctx.db.insert("billingGrants", {
        product: "school",
        tenantId,
        scope: { kind: "tenant" },
        seats: 300,
        ninaSeats: 0,
        source: { kind: "contract", contractId: "contract-school-test" },
        validFrom: 0,
        validTo: Date.UTC(2099, 0, 1),
      });
      const exit = await exitInMutation(
        ctx,
        issueOrder(tenantId, { kind: "accounts", accounts: 5 })
      );
      return Exit.match(exit, {
        onFailure: (cause) => String(Cause.squash(cause)),
        onSuccess: () => "issued",
      });
    });
    expect(failure).toContain("SchoolPlanMissing");
  });

  it("lets an open invoice whose period has ended hold no new order back", async () => {
    const t = createBillingTestConvex();
    const numbers = await t.run(async (ctx) => {
      const tenantId = await insertSchool(ctx);
      const old = await runInMutation(
        ctx,
        issueOrder(tenantId, {
          kind: "plan",
          accounts: 0,
          months: 1,
          plan: "pro",
        })
      );
      await ctx.db.patch(old.invoiceId, { periodEnd: NOW - 1 });
      const next = await runInMutation(
        ctx,
        issueOrder(tenantId, {
          kind: "plan",
          accounts: 0,
          months: 3,
          plan: "pro",
        })
      );
      return [old.number, next.number];
    });
    expect(numbers).toEqual(["NKF-2026-000001", "NKF-2026-000002"]);
  });
});

describe("billing/school payments", () => {
  it("pays an invoice once, grants Pro for its period and accounts, and journals the payment", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const tenantId = await insertSchool(ctx);
      const issued = await runInMutation(
        ctx,
        issueOrder(tenantId, {
          kind: "plan",
          accounts: 5,
          months: 12,
          plan: "pro",
        })
      );
      const outcome = await runInMutation(ctx, payInvoice(issued.invoiceId));
      const repeated = await runInMutation(ctx, payInvoice(issued.invoiceId));
      return {
        grants: await ctx.db.query("billingGrants").collect(),
        invoice: await ctx.db.get(issued.invoiceId),
        journal: await journalOf(ctx, tenantId, "billing.invoice.paid"),
        outcome,
        payments: await ctx.db.query("billingPayments").collect(),
        repeated,
      };
    });
    const period = schoolPeriod(NOW, 12);
    expect(result.outcome).toBe("applied");
    expect(result.repeated).toBe("duplicate");
    expect(result.invoice?.status).toBe("paid");
    expect(result.payments).toMatchObject([
      {
        kind: "invoice",
        method: "transfer",
        rail: "xendit",
        status: "succeeded",
      },
    ]);
    expect(result.grants).toMatchObject([
      {
        ninaSeats: 105,
        product: "school",
        seats: 105,
        source: { kind: "invoice" },
        validFrom: period.start,
        validTo: period.end,
      },
    ]);
    expect(result.journal).toMatchObject([
      { change: { method: "transfer", type: "billing.invoice.paid" } },
    ]);
  });

  it("refuses to pay an invoice of an account no school owns", async () => {
    const t = createBillingTestConvex();
    const failure = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "auth-school-invoice",
        credits: 0,
        creditsResetAt: 0,
        email: "invoice@example.com",
        mascot: MASCOT_CODE,
        name: "Invoice",
        plan: "free",
      });
      const accountId = await ctx.db.insert("billingAccounts", {
        owner: { kind: "personal", userId },
        rail: "xendit",
        country: "ID",
        currency: "IDR",
        providerCustomerId: null,
      });
      const invoiceId = await ctx.db.insert("billingInvoices", {
        accountId,
        number: "NKF-2026-000009",
        status: "open",
        currency: "IDR",
        lines: [
          {
            description: "school.pro",
            quantity: 1,
            unitAmount: 100_000,
            amount: 100_000,
          },
        ],
        total: 100_000,
        periodStart: 0,
        periodEnd: 1,
        dueAt: 1,
        paymentLink: null,
        buyerTaxId: null,
      });
      const exit = await exitInMutation(
        ctx,
        applyInvoicePaid(systemActor, invoiceId, {
          method: "session",
          paidAt: NOW,
          providerPaymentId: "py-1",
        })
      );
      return Exit.match(exit, {
        onFailure: (cause) => String(Cause.squash(cause)),
        onSuccess: () => "paid",
      });
    });
    expect(failure).toContain("BillingRowMissing");
  });
});
