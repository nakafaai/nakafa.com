import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
import { Scheduler } from "@repo/backend/confect/_generated/services";
import { BillingCurrency } from "@repo/backend/confect/billing/catalog";
import { hasActiveProGrant } from "@repo/backend/confect/billing/grants";
import { recordPayment } from "@repo/backend/confect/billing/payments";
import {
  grantTopUpLot,
  refundLotOfPayment,
} from "@repo/backend/confect/credits/lots";
import { Clock, Duration, Effect, Schema } from "effect";

const TopUpOrderSchema = Schema.Struct({
  accountId: IdSchema("billingAccounts"),
  userId: IdSchema("users"),
  /** Top-up packs are sold through Polar only. */
  rail: Schema.Literal("polar"),
  providerPaymentId: Schema.String,
  amount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  currency: BillingCurrency,
  /** The net amount, before taxes, that a refund of the order may take. */
  refundableAmount: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  /** The provider's own update time of the order, which orders the payment's states. */
  providerUpdatedAt: Schema.Finite,
});

/** One top-up order as its rail reports it. The amount is in the currency's minor unit. */
export type TopUpOrder = typeof TopUpOrderSchema.Type;

/** The method a top-up pack is paid with: one order on the rail's hosted checkout. */
const TOP_UP_METHOD = "order";

/** The payment row one order state writes. A top-up payment pays for a pack, so its kind is `credits`. */
function paymentOf(order: TopUpOrder, status: "succeeded" | "refunded") {
  return {
    kind: "credits" as const,
    accountId: order.accountId,
    status,
    amount: order.amount,
    currency: order.currency,
    rail: order.rail,
    providerPaymentId: order.providerPaymentId,
    providerUpdatedAt: order.providerUpdatedAt,
    method: TOP_UP_METHOD,
    paidAt: order.providerUpdatedAt,
  };
}

/**
 * Records a paid top-up order and grants its pack, the first time the payment is
 * seen. A payment that arrives again changes nothing, so a retried webhook never
 * grants a second pack. A learner without an active Pro grant keeps the payment
 * on record and gets no pack; the order is then refunded through Polar, and the
 * refund's own `order.refunded` event leaves the payment refunded.
 */
export const applyTopUpPaid = Effect.fn("billing.topup.applyPaid")(function* (
  order: TopUpOrder
) {
  const recorded = yield* recordPayment(paymentOf(order, "succeeded"));
  if (recorded.kind !== "recorded") {
    return "duplicate" as const;
  }
  const now = yield* Clock.currentTimeMillis;
  if (!(yield* hasActiveProGrant(order.userId, now))) {
    yield* Effect.logError(
      "Top-up payment arrived without an active Pro grant",
      {
        paymentId: recorded.paymentId,
        providerPaymentId: order.providerPaymentId,
      }
    );
    // An order that charged nothing, such as a fully discounted one, has nothing to refund.
    if (order.refundableAmount > 0) {
      yield* (yield* Scheduler).runAfter(
        Duration.zero,
        refs.internal.billing.topup.refundWithoutPro,
        {
          orderId: order.providerPaymentId,
          refundableAmount: order.refundableAmount,
        }
      );
    }
    return "withoutPro" as const;
  }
  yield* grantTopUpLot({
    userId: order.userId,
    paymentId: recorded.paymentId,
    paidAt: order.providerUpdatedAt,
  });
  return "applied" as const;
});

/**
 * Records a refunded top-up order and removes the unused credits of its pack.
 * Credits the learner already spent stay spent. A refund of a payment Nakafa
 * never saw paid is recorded, and no pack exists to remove.
 */
export const applyTopUpRefunded = Effect.fn("billing.topup.applyRefunded")(
  function* (order: TopUpOrder) {
    const recorded = yield* recordPayment(paymentOf(order, "refunded"));
    if (recorded.kind === "recorded") {
      return "unseen" as const;
    }
    if (recorded.kind === "duplicate") {
      return "duplicate" as const;
    }
    yield* refundLotOfPayment(recorded.paymentId);
    return "applied" as const;
  }
);
