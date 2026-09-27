import { FunctionSpec, GroupSpec } from "@confect/core";
import { ProductAnalyticsCaptureError } from "@repo/backend/confect/analytics/capture.spec";
import { ConsentPersistenceError } from "@repo/backend/confect/consents/schema";
import {
  CheckoutSessionIoErrorWire,
  checkoutAdmissionArgsValidator,
  checkoutAdmissionValidator,
} from "@repo/backend/confect/customers/checkout/spec";
import { Schema } from "effect";
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "admitCheckoutSession",
    args: () => checkoutAdmissionArgsValidator.fields,
    returns: () => checkoutAdmissionValidator,
    error: () =>
      Schema.Union([
        CheckoutSessionIoErrorWire,
        ConsentPersistenceError,
        ProductAnalyticsCaptureError,
      ]),
  })
);
