import { internalMutation } from "@repo/backend/convex/_generated/server";
import {
  captureProductEvent,
  type ProductAnalyticsCaptureError,
} from "@repo/backend/convex/analytics/capture";
import { productAnalyticsEventValidator } from "@repo/backend/convex/analytics/events";
import { isAccountDeletionPending } from "@repo/backend/convex/auth/deletion/state";
import { checkoutSessionIoError } from "@repo/backend/convex/customers/checkout/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { type Infer, v } from "convex/values";
import { Effect } from "effect";

type CheckoutAdmissionUser = Parameters<typeof isAccountDeletionPending>[0];

interface CheckoutAdmissionOperations {
  readonly captureEvent: () => Effect.Effect<
    boolean,
    ProductAnalyticsCaptureError
  >;
  readonly loadUser: () => Promise<CheckoutAdmissionUser | null>;
}

const checkoutAdmissionArgsValidator = v.object({
  event: productAnalyticsEventValidator,
  timestamp: v.optional(v.number()),
  userId: vv.id("users"),
});

export type CheckoutAdmissionArgs = Infer<
  typeof checkoutAdmissionArgsValidator
>;

/** Revalidates account access after Polar IO without gating sales on analytics. */
export const admitCheckoutProgram = Effect.fn(
  "customers.checkout.admitCheckout"
)(function* (operations: CheckoutAdmissionOperations) {
  const user = yield* Effect.tryPromise({
    try: operations.loadUser,
    catch: checkoutSessionIoError,
  });

  if (!user || isAccountDeletionPending(user)) {
    return false;
  }

  yield* operations
    .captureEvent()
    .pipe(
      Effect.catchTag("ProductAnalyticsCaptureError", (error) =>
        Effect.logWarning("Checkout analytics capture failed.").pipe(
          Effect.annotateLogs({ code: error.code, reason: error.message })
        )
      )
    );

  return true;
});

/** Mutation-ordered checkout admission with consent-aware optional analytics. */
export const admitCheckoutSession = internalMutation({
  args: checkoutAdmissionArgsValidator.fields,
  returns: v.boolean(),
  handler: (ctx, args) =>
    runConvexProgram(
      admitCheckoutProgram({
        captureEvent: () =>
          captureProductEvent(ctx, {
            distinctId: args.userId,
            event: args.event,
            timestamp:
              args.timestamp === undefined
                ? undefined
                : new Date(args.timestamp),
          }),
        loadUser: () => ctx.db.get("users", args.userId),
      })
    ),
});
