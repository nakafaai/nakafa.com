import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { tenantAccess } from "@repo/backend/confect/access/authority";
import {
  type BillingAccountId,
  findAccount,
} from "@repo/backend/confect/billing/accounts";
import {
  billingOfferPrice,
  SCHOOL_FREE_STUDENTS,
} from "@repo/backend/confect/billing/catalog";
import { billingCurrencyFor } from "@repo/backend/confect/billing/route";
import {
  issueSchoolInvoice,
  requestInvoiceSession,
  runningSchoolGrants,
  schoolRail,
} from "@repo/backend/confect/billing/school";
import spec from "@repo/backend/confect/billing/school.spec";
import { countStudents } from "@repo/backend/confect/billing/seats";
import {
  CheckoutOfferUnavailable,
  checkoutOfferUnavailableCode,
} from "@repo/backend/confect/billing/spec";
import {
  proratedPrice,
  type SchoolOffer,
  TermOffer,
  termOf,
} from "@repo/backend/confect/billing/term";
import { schoolPoolMonthOf } from "@repo/backend/confect/credits/pool";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import {
  Array as Arr,
  Clock,
  DateTime,
  Effect,
  Layer,
  Option,
  Order,
} from "effect";

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
    Order.flip(
      Order.mapInput(
        Order.Number,
        (invoice: (typeof invoices)[number]) => invoice._creationTime
      )
    )
  );
});

/** The Polar offers a school outside Indonesia buys seats on, and the months each one runs. */
const POLAR_OFFERS = [
  { offer: "school.seat.month", months: 1 },
  { offer: "school.seat.year", months: 12 },
] as const;

/**
 * What each offer of a school's rail costs for `seats` students at `now`. An
 * Indonesian school pays a term by invoice at the term's price for the days left;
 * any other school buys Polar seats, which start now at the catalog price.
 */
function quotesOf(country: string, seats: number, now: number) {
  const currency = billingCurrencyFor(country);
  const quote = (
    offer: typeof SchoolOffer.Type,
    period: { readonly start: number; readonly end: number },
    priceOf: (price: number) => number
  ) =>
    Option.map(
      Option.fromNullishOr(billingOfferPrice(offer, currency)),
      (price) => ({
        offer,
        seats,
        unitAmount: priceOf(price),
        total: seats * priceOf(price),
        periodStart: period.start,
        periodEnd: period.end,
      })
    );
  if (schoolRail(country) === "xendit") {
    return Arr.getSomes(
      Arr.map(TermOffer.literals, (offer) => {
        const term = termOf(offer, country, now);
        return quote(offer, term, (price) => proratedPrice(price, term, now));
      })
    );
  }
  return Arr.getSomes(
    Arr.map(POLAR_OFFERS, ({ months, offer }) =>
      quote(
        offer,
        {
          start: now,
          end: DateTime.toEpochMillis(
            DateTime.add(DateTime.makeUnsafe(now), { months })
          ),
        },
        (price) => price
      )
    )
  );
}

/**
 * The school's plan, students and invoices, read at the moment of the query. The
 * terms on offer are quoted for the students its running grants do not pay for
 * yet, at each term's price for the days still to run.
 */
const overview = FunctionImpl.make(
  databaseSchema,
  spec,
  "overview",
  Effect.fn("billing.school.overview")(function* () {
    const { tenant } = yield* Member;
    const now = yield* Clock.currentTimeMillis;
    const students = yield* countStudents(tenant._id);
    const grants = yield* runningSchoolGrants(tenant._id, now);
    const seats = Arr.reduce(grants, 0, (total, grant) => total + grant.seats);
    const rail = schoolRail(tenant.country);
    const account = yield* findAccount(
      { kind: "tenant", tenantId: tenant._id },
      rail
    );
    const invoices = Option.isSome(account)
      ? yield* readInvoices(account.value._id)
      : [];
    const nina = yield* schoolPoolMonthOf(
      tenant._id,
      Arr.reduce(grants, 0, (total, grant) => total + grant.ninaSeats),
      now
    );
    const unpaid = Math.max(students - seats, 0);
    const quotes = unpaid > 0 ? quotesOf(tenant.country, unpaid, now) : [];
    return {
      tenantId: tenant._id,
      plan: Option.match(Arr.head(grants), {
        onNone: () => ({ kind: "free" as const, limit: SCHOOL_FREE_STUDENTS }),
        onSome: (latest) => ({
          kind: "school" as const,
          seats,
          validTo: latest.validTo,
          nina,
        }),
      }),
      students,
      rail,
      currency: billingCurrencyFor(tenant.country),
      quotes,
      invoices: Arr.map(invoices, (invoice) => ({
        number: invoice.number,
        status: invoice.status,
        currency: invoice.currency,
        total: invoice.total,
        periodStart: invoice.periodStart,
        periodEnd: invoice.periodEnd,
        dueAt: invoice.dueAt,
        paymentLink: invoice.paymentLink,
        seats: Arr.reduce(
          invoice.lines,
          0,
          (total, line) => total + line.quantity
        ),
      })),
    };
  })
);

/**
 * Issues the invoice of one term for the students not yet paid for, or returns the
 * open invoice of that term. While Indonesia pays through Xendit, an invoice without
 * a payment link gets its hosted payment opened at once; until then the school pays
 * by bank transfer, which an operator records.
 */
const pay = FunctionImpl.make(
  databaseSchema,
  spec,
  "pay",
  Effect.fn("billing.school.pay")(function* ({ offer }) {
    const { person, tenant } = yield* Member;
    const issued = yield* issueSchoolInvoice(
      personActor(person),
      tenant,
      offer
    ).pipe(
      Effect.catchTags({
        // The school's account and the invoice sequence are ledger faults, never the payer's.
        BillingRowMissing: Effect.die,
        InvoiceNumberExhausted: Effect.die,
        OfferUnavailable: () =>
          Effect.fail(
            new CheckoutOfferUnavailable({
              code: checkoutOfferUnavailableCode,
              message: "This offer is not available here.",
            })
          ),
      })
    );
    yield* requestInvoiceSession(tenant, issued.invoiceId, offer);
    return { number: issued.number };
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(overview),
  Layer.provide(pay),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(tenantAccess),
  GroupImpl.finalize
);
