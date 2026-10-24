import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { BillingCurrency } from "@repo/backend/confect/billing/catalog";
import { nextInvoiceNumber } from "@repo/backend/confect/billing/numbering";
import { billingInvoiceLineValidator } from "@repo/backend/confect/billing/schema";
import { Array as Arr, Effect, Schema, Struct } from "effect";

/** One invoice to issue. Each line's amount is its quantity times its unit amount, computed here. */
const InvoiceInput = Schema.Struct({
  accountId: IdSchema("billingAccounts"),
  buyerTaxId: Schema.NullOr(Schema.String),
  currency: BillingCurrency,
  dueAt: Schema.Finite,
  lines: Schema.NonEmptyArray(
    Schema.Struct(
      Struct.pick(billingInvoiceLineValidator.fields, [
        "description",
        "quantity",
        "unitAmount",
      ])
    )
  ),
  periodEnd: Schema.Finite,
  periodStart: Schema.Finite,
  year: Schema.Int,
});
type InvoiceInput = typeof InvoiceInput.Type;

/**
 * Issues one open invoice with the next number of its year, in the caller's
 * transaction. The total is the sum of the computed line amounts.
 */
export const issueInvoice = Effect.fn("billing.invoices.issue")(function* (
  input: InvoiceInput
) {
  const lines = Arr.map(input.lines, (line) => ({
    ...line,
    amount: line.quantity * line.unitAmount,
  }));
  const total = Arr.reduce(lines, 0, (sum, line) => sum + line.amount);
  const number = yield* nextInvoiceNumber(input.year);
  const writer = yield* DatabaseWriter;
  const invoiceId = yield* writer
    .table("billingInvoices")
    .insert({
      accountId: input.accountId,
      number,
      status: "open",
      currency: input.currency,
      lines,
      total,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      dueAt: input.dueAt,
      paymentLink: null,
      buyerTaxId: input.buyerTaxId,
    })
    .pipe(Effect.orDie);
  return { invoiceId, number, total };
});
