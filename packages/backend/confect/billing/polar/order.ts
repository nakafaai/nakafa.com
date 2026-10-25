import { findAccountByProviderCustomer } from "@repo/backend/confect/billing/accounts";
import { BillingCurrency } from "@repo/backend/confect/billing/catalog";
import { polarOfferOf } from "@repo/backend/confect/billing/polar/catalog";
import { decodePolarOrder } from "@repo/backend/confect/billing/polar/payload";
import {
  applyTopUpPaid,
  applyTopUpRefunded,
} from "@repo/backend/confect/billing/topup";
import { Effect, Option, Schema } from "effect";

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
export const applyPolarOrder = Effect.fn("billing.polar.applyOrder")(function* (
  data: unknown,
  change: "paid" | "refunded"
) {
  const decoded = yield* decodePolarOrder(data).pipe(Effect.option);
  if (Option.isNone(decoded)) {
    return "invalid" as const;
  }
  const order = decoded.value;
  if (order.subscriptionId !== null || !isTopUpOrderProduct(order.productId)) {
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
});
