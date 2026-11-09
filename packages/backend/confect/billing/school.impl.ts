import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { tenantAccess } from "@repo/backend/confect/access/authority";
import {
  type BillingAccountId,
  findAccount,
} from "@repo/backend/confect/billing/accounts";
import { schoolInvoice } from "@repo/backend/confect/billing/receipts";
import {
  invoiceAccounts,
  issueSchoolInvoice,
  requestInvoiceSession,
  runningPlan,
  runningSchoolGrants,
} from "@repo/backend/confect/billing/school";
import spec from "@repo/backend/confect/billing/school.spec";
import {
  accountLimit,
  countAccounts,
} from "@repo/backend/confect/billing/seats";
import {
  SCHOOL_TRIAL_DAYS,
  schoolAccount,
  schoolTiers,
} from "@repo/backend/confect/billing/tiers";
import {
  currencyOfCountry,
  railOfCountry,
} from "@repo/backend/confect/country/registry";
import { schoolPoolMonthOf } from "@repo/backend/confect/credits/pool";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import {
  Array as Arr,
  Clock,
  Duration,
  Effect,
  Layer,
  Option,
  Order,
} from "effect";

/** Bytes in a number of megabytes, 1 GB being 1,000 MB as the plans count Drive. */
const megabytes = (count: number) => count * 1_000_000;

/** The most invoices the billing page lists. A school is issued a few a year. */
const INVOICE_LIST_LIMIT = 48;

/** The invoices of one school's account, newest first. */
const readInvoices = Effect.fn("billing.school.readInvoices")(function* (
  accountId: BillingAccountId
) {
  const invoices = yield* (yield* DatabaseReader)
    .table("billingInvoices")
    .index("by_accountId_and_status", (query) =>
      query.eq("accountId", accountId)
    )
    .take(INVOICE_LIST_LIMIT)
    .pipe(Effect.orDie);
  return Arr.sort(
    invoices,
    Order.mapInput(
      Order.flip(Order.Number),
      (invoice: (typeof invoices)[number]) => invoice._creationTime
    )
  );
});

/**
 * The school's plan, accounts, Drive and invoices, read at the moment of the
 * query. The page prices an order with `billing/quote.ts` from the plan's period
 * and the school's currency; the server prices it again when it issues.
 */
const overview = FunctionImpl.make(
  databaseSchema,
  spec,
  "overview",
  Effect.fn("billing.school.overview")(function* () {
    const { tenant } = yield* Member;
    const now = yield* Clock.currentTimeMillis;
    const grants = yield* runningSchoolGrants(tenant._id, now);
    const plan = yield* runningPlan(grants);
    const rail = railOfCountry(tenant.country);
    const account = yield* findAccount(
      { kind: "tenant", tenantId: tenant._id },
      rail
    );
    const invoices = Option.isSome(account)
      ? yield* readInvoices(account.value._id)
      : [];
    const credits = yield* schoolPoolMonthOf(
      tenant._id,
      Arr.reduce(grants, 0, (total, grant) => total + grant.ninaSeats),
      now
    );
    const limit = yield* accountLimit(tenant._id, now);
    const state = Option.match(plan, {
      onNone: () =>
        Option.match(Arr.head(grants), {
          onNone: () => ({
            plan: {
              kind: "trial" as const,
              endsAt:
                tenant._creationTime +
                Duration.toMillis(Duration.days(SCHOOL_TRIAL_DAYS)),
            },
            driveBytes: megabytes(schoolTiers.free.storageMegabytes),
          }),
          onSome: (latest) => ({
            plan: {
              kind: "school" as const,
              validTo: latest.validTo,
              credits,
            },
            // A contract or Polar seats set the accounts, and each holds the Drive of one added account.
            driveBytes: megabytes(limit * schoolAccount.storageMegabytes),
          }),
        }),
      onSome: (running) => {
        const added = Math.max(limit - schoolTiers[running.plan].accounts, 0);
        return {
          plan: {
            kind: running.plan,
            period: running.period,
            added,
            credits,
          },
          driveBytes: megabytes(
            schoolTiers[running.plan].storageMegabytes +
              added * schoolAccount.storageMegabytes
          ),
        };
      },
    });
    return {
      tenantId: tenant._id,
      plan: state.plan,
      accounts: { limit, used: yield* countAccounts(tenant._id) },
      driveBytes: state.driveBytes,
      rail,
      currency: Option.match(account, {
        onNone: () => currencyOfCountry(tenant.country),
        onSome: (found) => found.currency,
      }),
      invoices: Arr.map(invoices, (invoice) => ({
        number: invoice.number,
        status: invoice.status,
        currency: invoice.currency,
        total: invoice.total,
        periodStart: invoice.periodStart,
        periodEnd: invoice.periodEnd,
        dueAt: invoice.dueAt,
        paymentLink: invoice.paymentLink,
        accounts: invoiceAccounts(invoice),
      })),
    };
  })
);

/** The PDF copy of one of the school's invoices, and nothing for another school's. */
const invoice = FunctionImpl.make(
  databaseSchema,
  spec,
  "invoice",
  Effect.fn("billing.school.invoice")(function* ({ locale, number }) {
    const { tenant } = yield* Member;
    const account = yield* findAccount(
      { kind: "tenant", tenantId: tenant._id },
      railOfCountry(tenant.country)
    );
    const found = yield* (yield* DatabaseReader)
      .table("billingInvoices")
      .index("by_number", (query) => query.eq("number", number))
      .first()
      .pipe(Effect.orDie);
    if (
      Option.isNone(account) ||
      Option.isNone(found) ||
      found.value.accountId !== account.value._id
    ) {
      return null;
    }
    return schoolInvoice(found.value, tenant.name, locale);
  })
);

/**
 * Issues the invoice of one order, or returns the open invoice the school holds. While
 * Indonesia pays through Xendit, an invoice without a payment link gets its hosted payment
 * opened at once; until then, and outside Indonesia, the school pays by bank transfer, which
 * an operator records.
 */
const pay = FunctionImpl.make(
  databaseSchema,
  spec,
  "pay",
  Effect.fn("billing.school.pay")(function* ({ order }) {
    const { person, tenant } = yield* Member;
    const issued = yield* issueSchoolInvoice(
      personActor(person),
      tenant,
      order
    ).pipe(
      Effect.catchTags({
        // The school's account and the invoice sequence are ledger faults, never the payer's.
        BillingRowMissing: Effect.die,
        InvoiceNumberExhausted: Effect.die,
      })
    );
    yield* requestInvoiceSession(tenant, issued.invoiceId);
    return { number: issued.number };
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(overview),
  Layer.provide(invoice),
  Layer.provide(pay),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(tenantAccess),
  GroupImpl.finalize
);
