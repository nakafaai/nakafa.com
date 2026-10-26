import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { applyInvoicePaid } from "@repo/backend/confect/billing/school";
import type { XenditSessionRequest } from "@repo/backend/confect/billing/xendit/contract";
import { systemActor } from "@repo/backend/confect/tenancy/actor";
import { Clock, DateTime, Effect } from "effect";

/**
 * The hosted session that pays one school invoice: one payment of its total
 * through any channel Xendit offers, in Indonesian, open until the invoice is due.
 * The invoice number is the session's reference, so Xendit's dashboard shows it.
 */
export function invoiceSessionRequest(invoice: {
  readonly dueAt: number;
  readonly number: string;
  readonly total: number;
}): XenditSessionRequest {
  return {
    reference_id: invoice.number,
    session_type: "PAY",
    mode: "PAYMENT_LINK",
    currency: "IDR",
    amount: invoice.total,
    country: "ID",
    description: `Nakafa School ${invoice.number}`,
    locale: "id",
    expires_at: DateTime.formatIso(DateTime.makeUnsafe(invoice.dueAt)),
  };
}

/** Pays the invoice a completed hosted session was opened for, which writes the school's School grant. */
export const applyInvoiceSessionPaid = Effect.fn(
  "billing.xendit.invoice.sessionPaid"
)(function* (invoiceId: Docs["billingInvoices"]["_id"], paymentId: string) {
  yield* applyInvoicePaid(systemActor, invoiceId, {
    method: "session",
    paidAt: yield* Clock.currentTimeMillis,
    providerPaymentId: paymentId,
  });
});

/**
 * Takes the payment link off an invoice whose hosted session closed unpaid, so
 * the next request to pay opens another. A paid invoice keeps the link it was
 * paid on.
 */
export const clearInvoiceLink = Effect.fn("billing.xendit.invoice.clearLink")(
  function* (invoiceId: Docs["billingInvoices"]["_id"]) {
    const invoice = yield* (yield* DatabaseReader)
      .table("billingInvoices")
      .get(invoiceId)
      .pipe(Effect.orDie);
    if (invoice.status !== "open") {
      return;
    }
    yield* (yield* DatabaseWriter)
      .table("billingInvoices")
      .patch(invoiceId, { paymentLink: null })
      .pipe(Effect.orDie);
  }
);
