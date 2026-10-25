import { findAccountByProviderCustomer } from "@repo/backend/confect/billing/accounts";
import { BillingCurrency } from "@repo/backend/confect/billing/catalog";
import { endSubscriptionGrant } from "@repo/backend/confect/billing/grantEnd";
import { syncSubscriptionGrant } from "@repo/backend/confect/billing/grants";
import { polarOfferOf } from "@repo/backend/confect/billing/polar/catalog";
import {
  decodePolarEnvelope,
  decodePolarOrder,
  decodePolarSubscription,
} from "@repo/backend/confect/billing/polar/payload";
import {
  polarGrantAction,
  polarSubscriptionState,
} from "@repo/backend/confect/billing/polar/subscription";
import { applySubscriptionState } from "@repo/backend/confect/billing/subscriptions";
import {
  applyTopUpPaid,
  applyTopUpRefunded,
} from "@repo/backend/confect/billing/topup";
import { Clock, Effect, Match, Option, Schema } from "effect";

/**
 * Applies one Polar subscription to the billing model, for a webhook and for the
 * reconciliation of listed subscriptions alike. The customer names the account,
 * the subscription names its row, and a state older than the stored one is refused.
 * The grant follows the status (see `polarGrantAction`). A subscription whose
 * product Nakafa does not sell is logged as an error and changes nothing.
 */
export const applyPolarSubscription = Effect.fn(
  "billing.polar.applySubscription"
)(function* (data: unknown) {
  const decoded = yield* decodePolarSubscription(data).pipe(Effect.option);
  if (Option.isNone(decoded)) {
    return "invalid" as const;
  }
  const subscription = decoded.value;
  const account = yield* findAccountByProviderCustomer(
    "polar",
    subscription.customerId
  );
  if (Option.isNone(account)) {
    return {
      kind: "unknownCustomer" as const,
      customerId: subscription.customerId,
    };
  }
  const state = polarSubscriptionState(account.value._id, subscription);
  if (Option.isNone(state)) {
    yield* Effect.logError(
      "Polar subscription is not a Pro offer Nakafa sells",
      {
        productId: subscription.productId,
        recurringInterval: subscription.recurringInterval,
        status: subscription.status,
        subscriptionId: subscription.id,
      }
    );
    return "unsupported" as const;
  }
  const applied = yield* applySubscriptionState(state.value);
  if (applied.kind === "stale") {
    return "stale" as const;
  }
  const action = polarGrantAction(subscription, yield* Clock.currentTimeMillis);
  if (action.kind === "endAt") {
    yield* endSubscriptionGrant(applied.subscriptionId, action.endsAt);
  } else if (state.value.currentPeriodEnd !== null) {
    yield* syncSubscriptionGrant(applied.subscriptionId);
  }
  return "applied" as const;
});

/** The currency a Polar order names, in Nakafa's upper-case codes, or none when Nakafa does not bill it. */
const decodeOrderCurrency = Schema.decodeUnknownOption(BillingCurrency);

/** Whether an order sells the Nina credit pack, on either Polar server. An order without a product does not. */
function isTopUpOrderProduct(productId: string | null): boolean {
  return (
    productId !== null && Option.contains(polarOfferOf(productId), "pro.topup")
  );
}

/**
 * Applies one Polar order that is a top-up pack, paid or refunded. An order that
 * renews a subscription belongs to that subscription, and an order for any other
 * product sells nothing here, so both are ignored. A top-up order of a customer
 * Nakafa holds no personal account for is reported and changes nothing.
 */
const applyTopUpOrderEvent = Effect.fn("billing.polar.applyTopUpOrder")(
  function* (data: unknown, change: "paid" | "refunded") {
    const decoded = yield* decodePolarOrder(data).pipe(Effect.option);
    if (Option.isNone(decoded)) {
      return "invalid" as const;
    }
    const order = decoded.value;
    if (
      order.subscriptionId !== null ||
      !isTopUpOrderProduct(order.productId)
    ) {
      return "ignored" as const;
    }
    if (change === "refunded" && order.refundedAmount <= 0) {
      return "ignored" as const;
    }
    const currency = decodeOrderCurrency(order.currency.toUpperCase());
    if (Option.isNone(currency)) {
      return "unsupported" as const;
    }
    const account = yield* findAccountByProviderCustomer(
      "polar",
      order.customerId
    );
    if (Option.isNone(account)) {
      return "unknownCustomer" as const;
    }
    if (account.value.owner.kind !== "personal") {
      return "unsupported" as const;
    }
    const topUp = {
      accountId: account.value._id,
      userId: account.value.owner.userId,
      rail: "polar" as const,
      providerPaymentId: order.id,
      amount: order.totalAmount,
      currency: currency.value,
      refundableAmount: order.refundableAmount,
      providerUpdatedAt: (order.modifiedAt ?? order.createdAt).getTime(),
    };
    return change === "paid"
      ? yield* applyTopUpPaid(topUp)
      : yield* applyTopUpRefunded(topUp);
  }
);

/** Routes one Polar event to the row it changes. Events that change no subscription or pack are ignored. */
const dispatch = (type: string, data: unknown) =>
  Match.value(type).pipe(
    Match.whenOr(
      "subscription.created",
      "subscription.updated",
      "subscription.active",
      "subscription.canceled",
      "subscription.past_due",
      "subscription.uncanceled",
      "subscription.revoked",
      () => applyPolarSubscription(data)
    ),
    Match.when("order.paid", () => applyTopUpOrderEvent(data, "paid")),
    Match.when("order.refunded", () => applyTopUpOrderEvent(data, "refunded")),
    Match.orElse(() => Effect.succeed("ignored" as const))
  );

/**
 * Applies one stored Polar delivery to the billing model and says what it did.
 * A body that does not decode is reported and changes nothing. A customer Nakafa
 * holds no account for is returned as unknown, so the caller can resolve it.
 */
export const processPolarEvent = Effect.fn("billing.polar.process")(function* (
  payload: string
) {
  const envelope = decodePolarEnvelope(payload);
  if (Option.isNone(envelope)) {
    return "invalid" as const;
  }
  return yield* dispatch(envelope.value.type, envelope.value.data);
});
