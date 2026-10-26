import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { scheduleSchoolProjection } from "@repo/backend/confect/billing/grants";
import { nextInvoiceNumber } from "@repo/backend/confect/billing/numbering";
import { billingCurrencyFor } from "@repo/backend/confect/billing/route";
import {
  applyInvoicePaid,
  ensureSchoolAccount,
} from "@repo/backend/confect/billing/school";
import {
  ContractWindowInvalid,
  InvoiceNotFound,
  TenantNotFound,
} from "@repo/backend/confect/billing/spec";
import { systemActor } from "@repo/backend/confect/tenancy/actor";
import { tenantAuthority } from "@repo/backend/confect/tenancy/authority";
import { Clock, Duration, Effect, Option, Schema } from "effect";

/** A school contract the operator signed and received payment for, outside any payment rail. */
const SchoolContract = Schema.Struct({
  contractId: Schema.String,
  seats: Schema.Int,
  tenantSlug: Schema.String,
  validFrom: Schema.Finite,
  validTo: Schema.Finite,
});
type SchoolContract = typeof SchoolContract.Type;

/** The school an operator names by its slug, or the failure that no school carries it. */
const readTenantBySlug = Effect.fn("billing.contracts.readTenant")(function* (
  slug: string
) {
  const tenant = yield* (yield* DatabaseReader)
    .table("tenants")
    .index("by_slug", (query) => query.eq("slug", slug))
    .first()
    .pipe(Effect.orDie);
  if (Option.isNone(tenant)) {
    return yield* new TenantNotFound({
      slug,
      message: `No school has the slug ${slug}.`,
    });
  }
  return tenant.value;
});

/**
 * Records one school contract as a grant of Pro for the school's students, for
 * its current term. A contract grant carries no Nina school pool, so the AI
 * cost of the school stays where the price was set. Bank-transfer payments have
 * no provider, so the operator's contract ID is the grant's only reference.
 *
 * The contract ID is the identity of the grant: a second call with the same ID
 * returns the grant the first call wrote, so a retried operator call never adds
 * a second grant. Changed terms need a new contract ID.
 */
export const recordSchoolContract = Effect.fn("billing.contracts.record")(
  function* (contract: SchoolContract) {
    if (contract.validTo <= contract.validFrom) {
      return yield* new ContractWindowInvalid({
        contractId: contract.contractId,
        message: `Contract ${contract.contractId} ends no later than it starts.`,
      });
    }
    const reader = yield* DatabaseReader;
    const tenant = yield* readTenantBySlug(contract.tenantSlug);
    const accountId = yield* ensureSchoolAccount(tenant);
    const existing = yield* reader
      .table("billingGrants")
      .index("by_source_contractId", (query) =>
        query.eq("source.contractId", contract.contractId)
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.isSome(existing)) {
      return { accountId, grantId: existing.value._id };
    }
    const writer = yield* DatabaseWriter;
    const grantId = yield* writer
      .table("billingGrants")
      .insert({
        product: "school",
        tenantId: tenant._id,
        scope: { kind: "tenant" },
        seats: contract.seats,
        ninaSeats: 0,
        source: { kind: "contract", contractId: contract.contractId },
        validFrom: contract.validFrom,
        validTo: contract.validTo,
      })
      .pipe(Effect.orDie);
    yield* scheduleSchoolProjection(tenant._id);
    return { accountId, grantId };
  }
);

/**
 * Records the free pilot of one school (K47): one real exam, PTS or PAS, with the
 * founder's help, as a contract grant over the exam's window. Its contract ID is
 * fixed per school, so a school has one pilot, and a second call returns it.
 */
export const recordSchoolPilot = Effect.fn("billing.contracts.recordPilot")(
  function* (pilot: {
    readonly seats: number;
    readonly tenantSlug: string;
    readonly validFrom: number;
    readonly validTo: number;
  }) {
    return yield* recordSchoolContract({
      contractId: `pilot:${pilot.tenantSlug}`,
      seats: pilot.seats,
      tenantSlug: pilot.tenantSlug,
      validFrom: pilot.validFrom,
      validTo: pilot.validTo,
    });
  }
);

/**
 * Records a bank transfer an operator received for one invoice, named by its
 * number: the invoice is paid, and its School grant and journal entry follow. The
 * transfer's bank reference is the payment's reference, so a second record of the
 * same transfer changes nothing.
 */
export const recordInvoiceTransfer = Effect.fn(
  "billing.contracts.recordTransfer"
)(function* (transfer: {
  readonly number: string;
  readonly paidAt: number;
  readonly reference: string;
}) {
  const invoice = yield* (yield* DatabaseReader)
    .table("billingInvoices")
    .index("by_number", (query) => query.eq("number", transfer.number))
    .first()
    .pipe(Effect.orDie);
  if (Option.isNone(invoice)) {
    return yield* new InvoiceNotFound({
      number: transfer.number,
      message: `No invoice has the number ${transfer.number}.`,
    });
  }
  return yield* applyInvoicePaid(systemActor, invoice.value._id, {
    method: "transfer",
    paidAt: transfer.paidAt,
    providerPaymentId: transfer.reference,
  });
});

/** How long an Enterprise school has to pay a contract invoice when the operator names no due day. */
const CONTRACT_DUE_MS = Duration.toMillis(Duration.days(30));

/**
 * Issues the invoice of one Enterprise contract (K9): the operator names the
 * school, the seats the contract covers, the price of one seat the contract set,
 * and the period it runs. The invoice takes the next number, bills in the school's
 * currency, carries the buyer's tax number when given, is due in 30 days, and is
 * journaled on the school. Its payment, a bank transfer the operator records or,
 * while Xendit takes Indonesia, a hosted session, grants the seats for the period.
 */
export const issueContractInvoice = Effect.fn("billing.contracts.issueInvoice")(
  function* (contract: {
    readonly buyerTaxId: string | null;
    readonly description: string;
    readonly periodEnd: number;
    readonly periodStart: number;
    readonly seats: number;
    readonly tenantSlug: string;
    readonly unitAmount: number;
  }) {
    if (contract.periodEnd <= contract.periodStart) {
      return yield* new ContractWindowInvalid({
        contractId: contract.description,
        message: `The contract of ${contract.tenantSlug} ends no later than it starts.`,
      });
    }
    const tenant = yield* readTenantBySlug(contract.tenantSlug);
    const accountId = yield* ensureSchoolAccount(tenant);
    const number = yield* nextInvoiceNumber();
    const now = yield* Clock.currentTimeMillis;
    const total = contract.seats * contract.unitAmount;
    const currency = billingCurrencyFor(tenant.country);
    const invoiceId = yield* (yield* DatabaseWriter)
      .table("billingInvoices")
      .insert({
        accountId,
        number,
        status: "open",
        currency,
        lines: [
          {
            description: contract.description,
            quantity: contract.seats,
            unitAmount: contract.unitAmount,
            amount: total,
          },
        ],
        total,
        periodStart: contract.periodStart,
        periodEnd: contract.periodEnd,
        dueAt: now + CONTRACT_DUE_MS,
        paymentLink: null,
        buyerTaxId: contract.buyerTaxId,
      })
      .pipe(Effect.orDie);
    yield* tenantAuthority.record(systemActor, tenant, {
      currency,
      number,
      total,
      type: "billing.invoice.issued",
    });
    return { invoiceId, number, tenant, total };
  }
);
