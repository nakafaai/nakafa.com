import { Schema } from "effect";
export const analyticsErasureRequestFailedCode =
  "ANALYTICS_ERASURE_REQUEST_FAILED";
/** Raised when a durable consent-overlap erasure cannot be admitted. */
export class AnalyticsErasureRequestError extends Schema.TaggedError<AnalyticsErasureRequestError>()(
  "AnalyticsErasureRequestError",
  {
    code: Schema.Literal(analyticsErasureRequestFailedCode),
    message: Schema.String,
  }
) {}
/** Public failure payload keeps the domain tag while preserving the deployed code/message transport. */
