import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type { billingPaymentValidator } from "@repo/backend/confect/billing/schema";
import { Effect, Option, Schema } from "effect";

type BillingPaymentInput = typeof billingPaymentValidator.Type;

/** Whether a payment was written now, or was already recorded by an earlier delivery. */
const PaymentRecorded = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("recorded"),
    paymentId: IdSchema("billingPayments"),
  }),
  Schema.Struct({
    kind: Schema.Literal("duplicate"),
    paymentId: IdSchema("billingPayments"),
  }),
]).pipe(Schema.toTaggedUnion("kind"));
type PaymentRecorded = typeof PaymentRecorded.Type;

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
