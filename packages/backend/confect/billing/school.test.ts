import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  applyInvoicePaid,
  ensureSchoolAccount,
  issueSchoolInvoice,
  schoolRail,
} from "@repo/backend/confect/billing/school";
import { termOf } from "@repo/backend/confect/billing/term";
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
import { Array as Arr, Cause, Effect, Exit } from "effect";

/** 26 Oct 2026, 12:00 in Jakarta: 67 of the 184 days of the first semester are still to run, counting today. */
const NOW = Date.UTC(2026, 9, 26, 5, 0, 0);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

/** Enrolls `count` students in one unit of a school, each with an active student grant. */
async function enrollStudents(
  ctx: MutationCtx,
  tenantId: Id<"tenants">,
  count: number
) {
  const unitId = await ctx.db.insert("tenantUnits", {
    contentLanguage: "id",
    level: "smp",
    name: "SMP",
    status: "active",
    tenantId,
    timeZone: "Asia/Jakarta",
  });
  for (const _ of Arr.range(1, count)) {
    const personId = await ctx.db.insert("tenantPeople", {
      account: { state: "unclaimed" },
      kind: "member",
      name: "Siswa",
      status: "active",
      tenantId,
    });
    await ctx.db.insert("tenantGrants", {
      grantedBy: { kind: "system" },
      personId,
      role: { key: "student", kind: "builtin" },
      scope: { kind: "unit", unitId },
      status: "active",
      tenantId,
      term: { kind: "standing" },
    });
  }
}

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

describe("billing/school invoices", () => {
  it("invoices the students the school does not pay for yet, for the days left of the term, once per term", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const tenantId = await insertSchool(ctx);
      await enrollStudents(ctx, tenantId, 3);
      await ctx.db.insert("billingGrants", {
        product: "school",
        tenantId,
        scope: { kind: "tenant" },
        seats: 1,
        ninaSeats: 1,
        source: { kind: "contract", contractId: "contract-school-test" },
        validFrom: 0,
        validTo: Date.UTC(2099, 0, 1),
      });
      const issue = () =>
        runInMutation(
          ctx,
          Effect.flatMap(readTenant(tenantId), (tenant) =>
            issueSchoolInvoice(systemActor, tenant, "school.seat.semester")
          )
        );
      const first = await issue();
      const again = await issue();
      const invoices = await ctx.db.query("billingInvoices").collect();
      return {
        again: again.number,
        first: first.number,
        invoices,
        journal: await journalOf(ctx, tenantId, "billing.invoice.issued"),
      };
    });
    const term = termOf("school.seat.semester", "ID", NOW);
    expect(result.again).toBe(result.first);
    expect(result.invoices).toMatchObject([
      {
        currency: "IDR",
        // Two unpaid students at Rp60.000 for 67 of the semester's 184 days.
        lines: [
          {
            description: "school.seat.semester",
            quantity: 2,
            unitAmount: 21_848,
          },
        ],
        total: 43_696,
        number: "NKF-2026-000001",
        periodEnd: term.end,
        periodStart: term.start,
        status: "open",
      },
    ]);
    expect(result.journal).toMatchObject([
      {
        change: {
          currency: "IDR",
          number: "NKF-2026-000001",
          total: 43_696,
          type: "billing.invoice.issued",
        },
      },
    ]);
  });

  it("issues nothing to a school whose students are all paid for", async () => {
    const t = createBillingTestConvex();
    const failure = await t.run(async (ctx) => {
      const tenantId = await insertSchool(ctx);
      const exit = await exitInMutation(
        ctx,
        Effect.flatMap(readTenant(tenantId), (tenant) =>
          issueSchoolInvoice(systemActor, tenant, "school.seat.year")
        )
      );
      return Exit.match(exit, {
        onFailure: (cause) => String(Cause.squash(cause)),
        onSuccess: () => "issued",
      });
    });
    expect(failure).toContain("SchoolSeatsPaid");
  });
});

describe("billing/school payments", () => {
  it("pays an invoice once, grants Pro for its term and seats, and journals the payment", async () => {
    const t = createBillingTestConvex();
    const result = await t.run(async (ctx) => {
      const tenantId = await insertSchool(ctx);
      await enrollStudents(ctx, tenantId, 2);
      const issued = await runInMutation(
        ctx,
        Effect.flatMap(readTenant(tenantId), (tenant) =>
          issueSchoolInvoice(systemActor, tenant, "school.seat.year")
        )
      );
      const payment = {
        method: "transfer" as const,
        paidAt: NOW,
        providerPaymentId: "BCA-0001",
      };
      const outcome = await runInMutation(
        ctx,
        applyInvoicePaid(systemActor, issued.invoiceId, payment)
      );
      const repeated = await runInMutation(
        ctx,
        applyInvoicePaid(systemActor, issued.invoiceId, payment)
      );
      return {
        grants: await ctx.db.query("billingGrants").collect(),
        invoice: await ctx.db.get(issued.invoiceId),
        journal: await journalOf(ctx, tenantId, "billing.invoice.paid"),
        outcome,
        payments: await ctx.db.query("billingPayments").collect(),
        repeated,
      };
    });
    const term = termOf("school.seat.year", "ID", NOW);
    expect(result.outcome).toBe("applied");
    expect(result.repeated).toBe("duplicate");
    expect(result.invoice?.status).toBe("paid");
    expect(result.payments).toMatchObject([
      {
        kind: "invoice",
        method: "transfer",
        providerPaymentId: "BCA-0001",
        rail: "xendit",
        status: "succeeded",
      },
    ]);
    expect(result.grants).toMatchObject([
      {
        ninaSeats: 2,
        product: "school",
        seats: 2,
        source: { kind: "invoice" },
        validFrom: term.start,
        validTo: term.end,
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
            description: "school.seat.year",
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
