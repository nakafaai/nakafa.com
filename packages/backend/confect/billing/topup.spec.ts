import { FunctionSpec, GroupSpec } from "@confect/core";
import { BillingCurrency } from "@repo/backend/confect/billing/catalog";
import { PolarRefundErrorWire } from "@repo/backend/confect/billing/polar/spec";
import { BillingRail } from "@repo/backend/confect/billing/schema";
import { XenditRefundErrorWire } from "@repo/backend/confect/billing/spec";
import { Schema } from "effect";

/**
 * Refunds a top-up order that paid without an active Pro grant, on the rail that
 * took the money. The rail's own refund event then settles the payment record.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalAction({
    name: "refundWithoutPro",
    args: () => ({
      currency: BillingCurrency,
      orderId: Schema.String,
      rail: BillingRail,
      refundableAmount: Schema.Finite,
    }),
    returns: () => Schema.Null,
    error: () => Schema.Union([PolarRefundErrorWire, XenditRefundErrorWire]),
  })
);
