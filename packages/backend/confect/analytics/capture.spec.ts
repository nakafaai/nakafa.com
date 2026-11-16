import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";
export const productAnalyticsCaptureFailedCode =
  "PRODUCT_ANALYTICS_CAPTURE_FAILED";
/** Raised when an admitted backend product event cannot be queued. */
export class ProductAnalyticsCaptureError extends Schema.TaggedError<
  ProductAnalyticsCaptureError,
  { readonly brand: unique symbol }
>()("ProductAnalyticsCaptureError", {
  code: Schema.Literal(productAnalyticsCaptureFailedCode),
  message: Schema.String,
}) {}
/** The internal action that delivers one anonymous product event to PostHog. */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalAction({
    name: "deliverProductEvent",
    args: () => ({
      event: Schema.String,
      properties: Schema.optionalKey(Schema.String),
      timestamp: Schema.optionalKey(Schema.Finite),
    }),
    returns: () => Schema.Null,
    error: () => ProductAnalyticsCaptureError,
  })
);
