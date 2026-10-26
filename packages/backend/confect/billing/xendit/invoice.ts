import type { XenditSessionRequest } from "@repo/backend/confect/billing/xendit/contract";
import { DateTime } from "effect";

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
