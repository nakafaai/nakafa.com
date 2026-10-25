import { FunctionSpec, GroupSpec } from "@confect/core";
import { PolarRefundErrorWire } from "@repo/backend/confect/billing/polar/spec";
import { Schema } from "effect";

/**
 * Refunds a top-up order that paid without an active Pro grant. Polar's own
 * `order.refunded` event then settles the payment record.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalAction({
    name: "refundWithoutPro",
    args: () => ({
      orderId: Schema.String,
      refundableAmount: Schema.Finite,
    }),
    returns: () => Schema.Null,
    error: () => PolarRefundErrorWire,
  })
);
