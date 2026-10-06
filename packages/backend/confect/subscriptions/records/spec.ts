import subscriptions from "@repo/backend/confect/_generated/tables/subscriptions";
import { Schema } from "effect";
export const subscriptionRecordIoFailedCode = "SUBSCRIPTION_RECORD_IO_FAILED";
export const subscriptionRecordValidator = subscriptions.Fields;
export const subscriptionRecordArgs = {
  subscription: subscriptionRecordValidator,
};
export type SubscriptionRecord = typeof subscriptionRecordValidator.Type;

/** Raised when Convex IO fails while upserting one subscription record. */
export class SubscriptionRecordIoError extends Schema.TaggedError<SubscriptionRecordIoError>()(
  "SubscriptionRecordIoError",
  {
    code: Schema.Literal(subscriptionRecordIoFailedCode),
    message: Schema.String,
  }
) {}
/** Public failure payload keeps the domain tag while preserving the deployed code/message transport. */
