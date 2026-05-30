import { Schema } from "effect";

export const subscriptionPlanSyncIoFailedCode =
  "SUBSCRIPTION_PLAN_SYNC_IO_FAILED";

/** Raised when Convex IO fails while recomputing one user's subscription plan. */
export class SubscriptionPlanSyncIoError extends Schema.TaggedError<SubscriptionPlanSyncIoError>()(
  "SubscriptionPlanSyncIoError",
  {
    code: Schema.Literal(subscriptionPlanSyncIoFailedCode),
    message: Schema.String,
  }
) {}
