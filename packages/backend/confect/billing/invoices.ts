import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import type { BillingAccountId } from "@repo/backend/confect/billing/accounts";
import type { BillingCurrency } from "@repo/backend/confect/billing/catalog";
import { nextInvoiceNumber } from "@repo/backend/confect/billing/numbering";
import type { billingInvoiceLineValidator } from "@repo/backend/confect/billing/schema";
import { Effect } from "effect";

export type BillingInvoiceId = Docs["billingInvoices"]["_id"];
type InvoiceLineInput = Pick<
  typeof billingInvoiceLineValidator.Type,
  "description" | "quantity" | "unitAmount"
>;

/** One invoice to issue. Each line's amount is its quantity times its unit amount, computed here. */
export interface InvoiceInput {
  readonly accountId: BillingAccountId;
  readonly buyerTaxId: string | null;
  readonly currency: BillingCurrency;
  readonly dueAt: number;
  readonly lines: readonly [InvoiceLineInput, ...InvoiceLineInput[]];
  readonly periodEnd: number;
  readonly periodStart: number;
  readonly year: number;
}

/**
 * Issues one open invoice with the next number of its year, in the caller's
 * transaction. The total is the sum of the computed line amounts.
 */
export const issueInvoice = Effect.fn("billing.invoices.issue")(function* (
  input: InvoiceInput
) {
  const lines = input.lines.map((line) => ({
    ...line,
    amount: line.quantity * line.unitAmount,
  }));
  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  const number = yield* nextInvoiceNumber(input.year);
  const writer = yield* DatabaseWriter;
  const invoiceId = yield* writer
    .table("billingInvoices")
    .insert({
      accountId: input.accountId,
      number,
      status: "open",
      currency: input.currency,
      lines: [lines[0], ...lines.slice(1)],
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
