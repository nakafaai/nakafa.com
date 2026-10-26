import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  BillingOfferKey,
  billingOfferPrice,
} from "@repo/backend/confect/billing/catalog";
import { nextInvoiceNumber } from "@repo/backend/confect/billing/numbering";
import { OfferUnavailable } from "@repo/backend/confect/billing/route";
import { BillingRowMissing } from "@repo/backend/confect/billing/spec";
import { proratedPrice } from "@repo/backend/confect/billing/term";
import { Effect, Schema } from "effect";

/**
 * One invoice to issue: an offer for a number of seats over a period, billed to an
 * account in the account's own currency from `billedFrom`. The price comes from the
 * catalog, never the caller.
 */
const InvoiceInput = Schema.Struct({
  accountId: IdSchema("billingAccounts"),
  billedFrom: Schema.Finite,
  buyerTaxId: Schema.NullOr(Schema.String),
  dueAt: Schema.Finite,
  offer: BillingOfferKey,
  periodEnd: Schema.Finite,
  periodStart: Schema.Finite,
  seats: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
});
type InvoiceInput = typeof InvoiceInput.Type;

/**
 * Issues one open invoice with the next number of the current year, in the
 * caller's transaction. The unit price is the offer's price in the account's
 * currency for the days of the period still to run from `billedFrom` (K45), so a
 * school that starts or adds students during a term pays for the rest of it. An
 * offer the currency does not sell fails as `OfferUnavailable`.
 */
export const issueInvoice = Effect.fn("billing.invoices.issue")(function* (
  input: InvoiceInput
) {
  const reader = yield* DatabaseReader;
  const account = yield* reader
    .table("billingAccounts")
    .get(input.accountId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  if (account === null) {
    return yield* new BillingRowMissing({
      table: "billingAccounts",
      message: `Account ${input.accountId} is gone.`,
    });
  }
  const price = billingOfferPrice(input.offer, account.currency);
  if (price === null) {
    return yield* new OfferUnavailable({
      offer: input.offer,
      rail: account.rail,
      currency: account.currency,
      message: `${input.offer} is not priced in ${account.currency}.`,
    });
  }
  const unitAmount = proratedPrice(
    price,
    { start: input.periodStart, end: input.periodEnd },
    input.billedFrom
  );
  const amount = input.seats * unitAmount;
  const number = yield* nextInvoiceNumber();
  const writer = yield* DatabaseWriter;
  const invoiceId = yield* writer
    .table("billingInvoices")
    .insert({
      accountId: input.accountId,
      number,
      status: "open",
      currency: account.currency,
      lines: [
        {
          description: input.offer,
          quantity: input.seats,
          unitAmount,
          amount,
        },
      ],
      total: amount,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      dueAt: input.dueAt,
      paymentLink: null,
      buyerTaxId: input.buyerTaxId,
    })
    .pipe(Effect.orDie);
  return { currency: account.currency, invoiceId, number, total: amount };
});
