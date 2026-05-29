import tables from "@repo/backend/convex/subscriptions/schema";
import type { Infer } from "convex/values";
import { Schema } from "effect";

export const subscriptionRecordIoFailedCode = "SUBSCRIPTION_RECORD_IO_FAILED";

export const subscriptionRecordValidator = tables.subscriptions.validator;

export const subscriptionRecordArgs = {
  subscription: subscriptionRecordValidator,
};

export type SubscriptionRecord = Infer<typeof subscriptionRecordValidator>;

/** Raised when Convex IO fails while upserting one subscription record. */
export class SubscriptionRecordIoError extends Schema.TaggedError<SubscriptionRecordIoError>()(
  "SubscriptionRecordIoError",
  {
    code: Schema.Literal(subscriptionRecordIoFailedCode),
    message: Schema.String,
  }
) {}
