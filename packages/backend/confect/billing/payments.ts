import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type { billingPaymentValidator } from "@repo/backend/confect/billing/schema";
import { Effect, Option, Schema } from "effect";

type BillingPaymentInput = typeof billingPaymentValidator.Type;

/** Whether a payment was written now, moved forward to a newer provider state, or was already held. */
const PaymentRecorded = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("recorded"),
    paymentId: IdSchema("billingPayments"),
  }),
  Schema.Struct({
    kind: Schema.Literal("updated"),
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
 * rail, so a payment a webhook delivers twice is written once. A later provider
 * state of a stored payment (a refund, or a failure that turns into a success)
 * moves the row forward. An equal or older state changes nothing, so the status
 * only moves forward in provider time.
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
  const writer = yield* DatabaseWriter;
  if (Option.isNone(existing)) {
    const paymentId = yield* writer
      .table("billingPayments")
      .insert(payment)
      .pipe(Effect.orDie);
    return { kind: "recorded", paymentId } satisfies PaymentRecorded;
  }
  if (payment.providerUpdatedAt <= existing.value.providerUpdatedAt) {
    return {
      kind: "duplicate",
      paymentId: existing.value._id,
    } satisfies PaymentRecorded;
  }
  // The time the money arrived is kept as first stored; only the state moves.
  yield* writer
    .table("billingPayments")
    .replace(existing.value._id, {
      ...payment,
      paidAt: existing.value.paidAt,
    })
    .pipe(Effect.orDie);
  return {
    kind: "updated",
    paymentId: existing.value._id,
  } satisfies PaymentRecorded;
});
