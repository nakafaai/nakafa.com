import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type { billingPaymentValidator } from "@repo/backend/confect/billing/schema";
import { Effect, Option } from "effect";

export type BillingPaymentId = Docs["billingPayments"]["_id"];
export type BillingPaymentInput = typeof billingPaymentValidator.Type;

/** Whether a payment was written now, or was already recorded by an earlier delivery. */
export type PaymentRecorded =
  | { readonly kind: "recorded"; readonly paymentId: BillingPaymentId }
  | { readonly kind: "duplicate"; readonly paymentId: BillingPaymentId };

/**
 * Records one payment that arrived. The provider's payment ID is unique per
 * rail, so a payment a webhook delivers twice is written once.
 */
export const recordPayment = Effect.fn("billing.payments.record")(function* (
  payment: BillingPaymentInput
) {
  const reader = yield* DatabaseReader;
  const existing = yield* reader
    .table("billingPayments")
    .index("by_rail_and_providerPaymentId", (query) =>
      query
        .eq("rail", payment.rail)
        .eq("providerPaymentId", payment.providerPaymentId)
    )
    .first()
    .pipe(Effect.orDie);
  if (Option.isSome(existing)) {
    return {
      kind: "duplicate",
      paymentId: existing.value._id,
    } satisfies PaymentRecorded;
  }
  const writer = yield* DatabaseWriter;
  const paymentId = yield* writer
    .table("billingPayments")
    .insert(payment)
    .pipe(Effect.orDie);
  return { kind: "recorded", paymentId } satisfies PaymentRecorded;
});
