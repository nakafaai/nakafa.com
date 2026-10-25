import { FunctionSpec, GroupSpec } from "@confect/core";
import {
  PolarSubscriptionListErrorWire,
  PolarSubscriptionOutcome,
} from "@repo/backend/confect/billing/polar/spec";
import {
  BillingRowMissing,
  GrantOwnerMismatch,
} from "@repo/backend/confect/billing/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import { Schema } from "effect";

/**
 * Brings the Polar subscriptions that hold access into the billing model. `run`
 * reads listed pages and applies each subscription through the webhook path; the
 * daily cron starts it at the first page, and a run schedules the pages it could not
 * read in the same run.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalAction({
      name: "run",
      args: () => ({
        page: Schema.Int,
      }),
      returns: () => Schema.Null,
      error: () => PolarSubscriptionListErrorWire,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "applySubscription",
      args: () => ({
        subscription: Schema.String,
      }),
      returns: () => PolarSubscriptionOutcome,
      error: () => Schema.Union([BillingRowMissing, GrantOwnerMismatch]),
    }).middleware(Atomic)
  );
