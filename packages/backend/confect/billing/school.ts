import type { GenericId } from "@confect/core";
import type { Docs, TenantsDoc } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
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
  billingCurrencyFor,
  xenditTakesIndonesia,
} from "@repo/backend/confect/billing/route";
import type { BillingRail } from "@repo/backend/confect/billing/schema";
import { countStudents } from "@repo/backend/confect/billing/seats";
import {
  BillingRowMissing,
  SchoolSeatsPaid,
  schoolSeatsPaidCode,
} from "@repo/backend/confect/billing/spec";
import { type TermOffer, termOf } from "@repo/backend/confect/billing/term";
import type { TenantActor } from "@repo/backend/confect/journal/schema";
import { tenantAuthority } from "@repo/backend/confect/tenancy/authority";
import { Array as Arr, Clock, Duration, Effect, Option } from "effect";

/**
 * Asks Xendit for the hosted payment of a school invoice while Xendit takes
 * Indonesia. Until then, and for a school outside Indonesia, the school pays by
 * bank transfer, which an operator records.
 */
export const requestInvoiceSession = Effect.fn(
  "billing.school.requestInvoiceSession"
)(function* (
  tenant: TenantsDoc,
  invoiceId: Docs["billingInvoices"]["_id"],
  offer: TermOffer
) {
  if (schoolRail(tenant.country) !== "xendit") {
    return;
  }
  if (!(yield* xenditTakesIndonesia().pipe(Effect.orDie))) {
    return;
  }
  yield* (yield* Scheduler).runAfter(
    Duration.zero,
    refs.internal.billing.xendit.invoice.open,
    { invoiceId, offer }
  );
});

/** How long a school has to pay an invoice once it is issued. */
const INVOICE_DUE_MS = Duration.toMillis(Duration.days(14));

/** The most School grants of one school read at once. A school buys a few a year: terms, added students and contracts. */
const SCHOOL_GRANT_LIMIT = 64;

/** The most open invoices of one school read at once. A school holds one per term at most. */
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

/** The School grants of one school that run at `now`, latest end first. */
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
    // Only School grants name a school, so this narrows the grant type and drops nothing.
    return Arr.filter(grants, (grant) => grant.product === "school");
  }
);

/** The students the running School grants of one school pay for at `now`. */
const paidSeats = Effect.fn("billing.school.paidSeats")(function* (
  tenantId: GenericId.GenericId<"tenants">,
  now: number
) {
  const grants = yield* runningSchoolGrants(tenantId, now);
  return Arr.reduce(grants, 0, (total, grant) => total + grant.seats);
});

/** The open invoice of one school's account for exactly one term, if the school holds one. */
const openTermInvoice = Effect.fn("billing.school.openTermInvoice")(function* (
  accountId: Docs["billingAccounts"]["_id"],
  term: { readonly start: number; readonly end: number }
) {
  const open = yield* (yield* DatabaseReader)
    .table("billingInvoices")
    .index("by_accountId_and_status", (query) =>
      query.eq("accountId", accountId).eq("status", "open")
    )
    .take(OPEN_INVOICE_LIMIT)
    .pipe(Effect.orDie);
  return Arr.findFirst(
    open,
    (invoice) =>
      invoice.periodStart === term.start && invoice.periodEnd === term.end
  );
});

/**
 * Issues the invoice one school pays for a term (K45, K47): one line for the
 * enrolled students its running grants do not pay for yet, at the term's price
 * for the days still to run, due in 14 days, and a journal entry for it. The open
 * invoice of the same term is returned instead, so a second request issues
 * nothing. A school whose students are all paid for has nothing to invoice.
 */
export const issueSchoolInvoice = Effect.fn("billing.school.issueInvoice")(
  function* (
    actor: typeof TenantActor.Type,
    tenant: TenantsDoc,
    offer: TermOffer
  ) {
    const now = yield* Clock.currentTimeMillis;
    const term = termOf(offer, tenant.country, now);
    const accountId = yield* ensureSchoolAccount(tenant);
    const open = yield* openTermInvoice(accountId, term);
    if (Option.isSome(open)) {
      return { invoiceId: open.value._id, number: open.value.number };
    }
    const seats =
      (yield* countStudents(tenant._id)) - (yield* paidSeats(tenant._id, now));
    if (seats < 1) {
      return yield* new SchoolSeatsPaid({
        code: schoolSeatsPaidCode,
        message: "Every enrolled student is already paid for.",
      });
    }
    const issued = yield* issueInvoice({
      accountId,
      billedFrom: now,
      buyerTaxId: null,
      dueAt: now + INVOICE_DUE_MS,
      offer,
      periodEnd: term.end,
      periodStart: term.start,
      seats,
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
 * written, and the school's members hold Pro for the invoice's term through a
 * School grant of the seats it paid for, which also sizes the school's Nina pool.
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
    const seats = Arr.reduce(
      invoice.lines,
      0,
      (total, line) => total + line.quantity
    );
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
