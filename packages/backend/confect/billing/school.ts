import type { GenericId } from "@confect/core";
import type { Docs, TenantsDoc } from "@repo/backend/confect/_generated/docs";
import billingInternal from "@repo/backend/confect/_generated/refs/billing.server";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { ensureAccount } from "@repo/backend/confect/billing/accounts";
import { scheduleSchoolProjection } from "@repo/backend/confect/billing/grants";
import { issueInvoice } from "@repo/backend/confect/billing/invoices";
import { recordPayment } from "@repo/backend/confect/billing/payments";
import {
  accountsQuote,
  periodMonths,
  planQuote,
  SchoolOrder,
  schoolPeriod,
} from "@repo/backend/confect/billing/quote";
import {
  billingCurrencyFor,
  xenditTakesIndonesia,
} from "@repo/backend/confect/billing/route";
import type { BillingRail } from "@repo/backend/confect/billing/schema";
import {
  BillingRowMissing,
  SchoolPlanMissing,
  schoolPlanMissingCode,
} from "@repo/backend/confect/billing/spec";
import { lineAccounts, linePlan } from "@repo/backend/confect/billing/tier";
import type { TenantActor } from "@repo/backend/confect/journal/schema";
import { tenantAuthority } from "@repo/backend/confect/tenancy/authority";
import { Array as Arr, Clock, Duration, Effect, Option, Result } from "effect";

/**
 * Asks Xendit for the hosted payment of a school invoice while Xendit takes
 * Indonesia. Until then, and for a school outside Indonesia, the school pays by
 * bank transfer, which an operator records.
 */
export const requestInvoiceSession = Effect.fn(
  "billing.school.requestInvoiceSession"
)(function* (tenant: TenantsDoc, invoiceId: Docs["billingInvoices"]["_id"]) {
  if (schoolRail(tenant.country) !== "xendit") {
    return;
  }
  if (!(yield* xenditTakesIndonesia().pipe(Effect.orDie))) {
    return;
  }
  yield* (yield* Scheduler).runAfter(
    Duration.zero,
    billingInternal.xendit.invoice.open,
    { invoiceId }
  );
});

/** How long a school has to pay an invoice once it is issued. */
const INVOICE_DUE_MS = Duration.toMillis(Duration.days(14));

/** The most School grants of one school read at once. A school buys a few a year: plans, added accounts and contracts. */
const SCHOOL_GRANT_LIMIT = 64;

/** The most open invoices of one school read at once. A school holds one whose period runs, and a few ended unpaid. */
const OPEN_INVOICE_LIMIT = 16;

/** The rail a school pays through, fixed when its account is made: Xendit in Indonesia, Polar seats elsewhere. */
export function schoolRail(country: string): BillingRail {
  return country === "ID" ? "xendit" : "polar";
}

/** The billing account of one school, made on first use in the school's country and currency. */
export const ensureSchoolAccount = Effect.fn("billing.school.ensureAccount")(
  function* (tenant: TenantsDoc) {
    return yield* ensureAccount({
      owner: { kind: "tenant", tenantId: tenant._id },
      rail: schoolRail(tenant.country),
      country: tenant.country,
      currency: billingCurrencyFor(tenant.country),
    });
  }
);

/** The School grants of one school that run at `now`, latest end first: started, and not ended. */
export const runningSchoolGrants = Effect.fn("billing.school.runningGrants")(
  function* (tenantId: GenericId.GenericId<"tenants">, now: number) {
    const grants = yield* (yield* DatabaseReader)
      .table("billingGrants")
      .index(
        "by_tenantId_and_validTo",
        (query) => query.eq("tenantId", tenantId).gt("validTo", now),
        "desc"
      )
      .take(SCHOOL_GRANT_LIMIT)
      .pipe(Effect.orDie);
    // Only School grants name a school, so the product narrows the grant type and drops nothing.
    const school = Arr.filter(grants, (grant) => grant.product === "school");
    // A plan paid ahead starts when the running one ends, so it runs only from its own start.
    return Arr.filter(school, (grant) => grant.validFrom <= now);
  }
);

/**
 * The paid plan that runs for a school, from the School grants that run at
 * `now`: the plan the latest grant's invoice sells, with that grant's period.
 * A school whose grants sell no plan (a contract, or accounts alone) runs none.
 */
export const runningPlan = Effect.fn("billing.school.runningPlan")(function* (
  grants: Effect.Success<ReturnType<typeof runningSchoolGrants>>
) {
  const reader = yield* DatabaseReader;
  const sold = yield* Effect.forEach(
    Arr.filterMap(grants, (grant) =>
      grant.source.kind === "invoice"
        ? Result.succeed({ grant, invoiceId: grant.source.invoiceId })
        : Result.failVoid
    ),
    ({ grant, invoiceId }) =>
      reader
        .table("billingInvoices")
        .get(invoiceId)
        .pipe(
          Effect.orDie,
          Effect.map((invoice) =>
            Arr.findFirst(invoice.lines, (line) =>
              linePlan(line.description)
            ).pipe(
              Option.flatMap((plan) =>
                Option.map(
                  periodMonths(grant.validFrom, grant.validTo),
                  (months) => ({
                    plan,
                    period: {
                      end: grant.validTo,
                      months,
                      start: grant.validFrom,
                    },
                  })
                )
              )
            )
          )
        )
  );
  return Arr.head(Arr.getSomes(sold));
});

/** The open invoice of one school's account whose period still runs at `now`. A school holds one open invoice at a time. */
const runningOpenInvoice = Effect.fn("billing.school.runningOpenInvoice")(
  function* (accountId: Docs["billingAccounts"]["_id"], now: number) {
    const open = yield* (yield* DatabaseReader)
      .table("billingInvoices")
      .index("by_accountId_and_status", (query) =>
        query.eq("accountId", accountId).eq("status", "open")
      )
      .take(OPEN_INVOICE_LIMIT)
      .pipe(Effect.orDie);
    return Arr.findFirst(open, (invoice) => invoice.periodEnd > now);
  }
);

/** The accounts one invoice pays for, across its lines. */
export const invoiceAccounts = (invoice: Docs["billingInvoices"]) =>
  Arr.reduce(
    invoice.lines,
    0,
    (total, line) => total + lineAccounts(line.description, line.quantity)
  );

/**
 * Issues the invoice one school pays for an order, due in 14 days, with a
 * journal entry for it. A plan runs for its whole period with the accounts the
 * school adds, from the end of the plan that runs or from now; more accounts run
 * from now to the end of the running plan, at its period's price for the days
 * left, and need a running plan. A school holds one open invoice at a time, so
 * an order while one is open returns it and issues nothing.
 */
export const issueSchoolInvoice = Effect.fn("billing.school.issueInvoice")(
  function* (
    actor: typeof TenantActor.Type,
    tenant: TenantsDoc,
    order: SchoolOrder
  ) {
    const now = yield* Clock.currentTimeMillis;
    const accountId = yield* ensureSchoolAccount(tenant);
    const open = yield* runningOpenInvoice(accountId, now);
    if (Option.isSome(open)) {
      return { invoiceId: open.value._id, number: open.value.number };
    }
    const account = yield* (yield* DatabaseReader)
      .table("billingAccounts")
      .get(accountId)
      .pipe(Effect.orDie);
    const running = yield* runningPlan(
      yield* runningSchoolGrants(tenant._id, now)
    );
    const draft = yield* SchoolOrder.match(order, {
      plan: ({ accounts, months, plan }) => {
        const period = schoolPeriod(
          Option.match(running, {
            onNone: () => now,
            onSome: (current) => current.period.end,
          }),
          months
        );
        return Effect.succeed({
          period,
          quote: planQuote({
            accounts,
            currency: account.currency,
            months,
            plan,
          }),
        });
      },
      accounts: ({ accounts }) =>
        Option.match(running, {
          onNone: () =>
            Effect.fail(
              new SchoolPlanMissing({
                code: schoolPlanMissingCode,
                message: "Accounts are added to a running plan.",
              })
            ),
          onSome: (current) =>
            Effect.succeed({
              period: { end: current.period.end, start: now },
              quote: accountsQuote({
                accounts,
                currency: account.currency,
                from: now,
                period: current.period,
              }),
            }),
        }),
    });
    const issued = yield* issueInvoice({
      accountId,
      buyerTaxId: null,
      dueAt: now + INVOICE_DUE_MS,
      lines: draft.quote.lines,
      periodEnd: draft.period.end,
      periodStart: draft.period.start,
      total: draft.quote.total,
    });
    yield* tenantAuthority.record(actor, tenant, {
      currency: issued.currency,
      number: issued.number,
      total: issued.total,
      type: "billing.invoice.issued",
    });
    return { invoiceId: issued.invoiceId, number: issued.number };
  }
);

/**
 * Records one paid school invoice once (K47): the invoice is paid, its payment is
 * written, and the school's members hold Pro for the invoice's period through a
 * School grant of the accounts it paid for, which also sizes the school's shared
 * AI credits.
 * An invoice that is no longer open changes nothing, so a payment that arrives
 * twice grants once.
 */
export const applyInvoicePaid = Effect.fn("billing.school.applyInvoicePaid")(
  function* (
    actor: typeof TenantActor.Type,
    invoiceId: Docs["billingInvoices"]["_id"],
    /** How the invoice was paid: through a hosted Xendit session, or by a bank transfer an operator records. */
    payment: {
      readonly method: "session" | "transfer";
      readonly paidAt: number;
      readonly providerPaymentId: string;
    }
  ) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    // The invoice is named by its own payment, so reading it back always finds the row.
    const invoice = yield* reader
      .table("billingInvoices")
      .get(invoiceId)
      .pipe(Effect.orDie);
    if (invoice.status !== "open") {
      return "duplicate" as const;
    }
    const account = yield* reader
      .table("billingAccounts")
      .get(invoice.accountId)
      .pipe(Effect.orDie);
    if (account.owner.kind !== "tenant") {
      return yield* new BillingRowMissing({
        table: "tenants",
        message: `Invoice ${invoice.number} bills no school.`,
      });
    }
    const tenant = yield* reader
      .table("tenants")
      .get(account.owner.tenantId)
      .pipe(Effect.orDie);
    yield* writer
      .table("billingInvoices")
      .patch(invoiceId, { status: "paid" })
      .pipe(Effect.orDie);
    yield* recordPayment({
      kind: "invoice",
      invoiceId,
      accountId: account._id,
      status: "succeeded",
      amount: invoice.total,
      currency: invoice.currency,
      rail: account.rail,
      providerPaymentId: payment.providerPaymentId,
      providerUpdatedAt: payment.paidAt,
      method: payment.method,
      paidAt: payment.paidAt,
    });
    const seats = invoiceAccounts(invoice);
    yield* writer
      .table("billingGrants")
      .insert({
        product: "school",
        tenantId: tenant._id,
        scope: { kind: "tenant" },
        seats,
        ninaSeats: seats,
        source: { kind: "invoice", invoiceId },
        validFrom: invoice.periodStart,
        validTo: invoice.periodEnd,
      })
      .pipe(Effect.orDie);
    yield* scheduleSchoolProjection(tenant._id);
    yield* tenantAuthority.record(actor, tenant, {
      method: payment.method,
      number: invoice.number,
      type: "billing.invoice.paid",
    });
    return "applied" as const;
  }
);
