import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { AnalyticsErasureRequestErrorWire } from "@repo/backend/confect/analytics/erasure/spec";
import { ConsentPersistenceErrorWire } from "@repo/backend/confect/consents/schema";
import { failureWire } from "@repo/backend/confect/failure";
import { Schema } from "effect";
export const productAnalyticsCaptureFailedCode =
  "PRODUCT_ANALYTICS_CAPTURE_FAILED";
/** Raised when an admitted backend product event cannot be queued. */
export class ProductAnalyticsCaptureError extends Schema.TaggedError<ProductAnalyticsCaptureError>()(
  "ProductAnalyticsCaptureError",
  {
    code: Schema.Literal(productAnalyticsCaptureFailedCode),
    message: Schema.String,
  }
) {}
/** Maps one Convex or PostHog failure into the analytics capture channel. */
/** Public failure payload keeps the domain tag while preserving the deployed code/message transport. */
export const ProductAnalyticsCaptureErrorWire = failureWire(
  ProductAnalyticsCaptureError
);
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalQuery({
      name: "isProductAnalyticsUserEligible",
      args: () => ({
        userId: IdSchema("users"),
      }),
      returns: () => Schema.Boolean,
      error: () =>
        Schema.Union([
          ProductAnalyticsCaptureErrorWire,
          ConsentPersistenceErrorWire,
        ]),
    })
  )
  .addFunction(
    FunctionSpec.internalAction({
      name: "deliverProductEvent",
      args: () => ({
        disableGeoip: Schema.Boolean,
        distinctId: IdSchema("users"),
        event: Schema.String,
        properties: Schema.optionalKey(Schema.String),
        timestamp: Schema.optionalKey(Schema.Finite),
      }),
      returns: () => Schema.Null,
      error: () =>
        Schema.Union([
          ProductAnalyticsCaptureErrorWire,
          AnalyticsErasureRequestErrorWire,
        ]),
    })
  );
