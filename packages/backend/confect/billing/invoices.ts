import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { nextInvoiceNumber } from "@repo/backend/confect/billing/numbering";
import { billingInvoiceValidator } from "@repo/backend/confect/billing/schema";
import { BillingRowMissing } from "@repo/backend/confect/billing/spec";
import { Effect, Schema } from "effect";

/**
 * One invoice to issue: its priced lines and their total over a period, billed
 * to an account in the account's own currency. School invoices price their lines
 * with `billing/quote.ts`, never from the caller's page.
 */
const InvoiceInput = Schema.Struct({
  accountId: IdSchema("billingAccounts"),
  buyerTaxId: Schema.NullOr(Schema.String),
  dueAt: Schema.Finite,
  lines: billingInvoiceValidator.fields.lines,
  periodEnd: Schema.Finite,
  periodStart: Schema.Finite,
  total: Schema.Int,
});
type InvoiceInput = typeof InvoiceInput.Type;

/** Issues one open invoice with the next number of the current year, in the caller's transaction. */
export const issueInvoice = Effect.fn("billing.invoices.issue")(function* (
  input: InvoiceInput
) {
  const account = yield* (yield* DatabaseReader)
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
  const number = yield* nextInvoiceNumber();
  const invoiceId = yield* (yield* DatabaseWriter)
    .table("billingInvoices")
    .insert({
      accountId: input.accountId,
      number,
      status: "open",
      currency: account.currency,
      lines: input.lines,
      total: input.total,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      dueAt: input.dueAt,
      paymentLink: null,
      buyerTaxId: input.buyerTaxId,
    })
    .pipe(Effect.orDie);
  return { currency: account.currency, invoiceId, number, total: input.total };
});
