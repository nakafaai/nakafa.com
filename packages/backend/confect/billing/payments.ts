import type { Docs } from "@repo/backend/confect/_generated/docs";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { findAccount } from "@repo/backend/confect/billing/accounts";
import {
  BillingRail,
  type billingPaymentValidator,
} from "@repo/backend/confect/billing/schema";
import { Array as Arr, Effect, Option, Order, Schema } from "effect";

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

/** The most payments the settings list: the newest of a learner's personal accounts. */
const RECENT_PAYMENT_LIMIT = 12;

/**
 * The newest payments a learner made on their personal accounts that went
 * through, newest first: what each paid for, how much in which currency, when,
 * and through which rail. The settings list them as the learner's receipts.
 */
export const readRecentPayments = Effect.fn("billing.payments.readRecent")(
  function* (userId: Docs["users"]["_id"]) {
    const reader = yield* DatabaseReader;
    const accounts = yield* Effect.forEach(BillingRail.literals, (rail) =>
      findAccount({ kind: "personal", userId }, rail)
    );
    const payments = yield* Effect.forEach(Arr.getSomes(accounts), (account) =>
      reader
        .table("billingPayments")
        .index(
          "by_accountId_and_paidAt",
          (query) => query.eq("accountId", account._id),
          "desc"
        )
        .take(RECENT_PAYMENT_LIMIT)
        .pipe(Effect.orDie)
    );
    const succeeded = Arr.filter(
      Arr.flatten(payments),
      (payment) => payment.status === "succeeded"
    );
    const newest = Arr.sort(
      succeeded,
      Order.mapInput(
        Order.flip(Order.Number),
        (payment: (typeof succeeded)[number]) => payment.paidAt
      )
    );
    return Arr.map(Arr.take(newest, RECENT_PAYMENT_LIMIT), (payment) => ({
      amount: payment.amount,
      currency: payment.currency,
      kind: payment.kind,
      paidAt: payment.paidAt,
      rail: payment.rail,
    }));
  }
);
