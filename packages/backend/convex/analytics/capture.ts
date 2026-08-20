import { ANALYTICS_CONSENT_CATEGORY } from "@repo/analytics/consent";
import { components } from "@repo/backend/convex/_generated/api";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { deletePostHogPerson } from "@repo/backend/convex/analytics/deletion";
import {
  type ProductAnalyticsEvent,
  productAnalyticsEventValidator,
} from "@repo/backend/convex/analytics/events";
import { isAccountDeletionPending } from "@repo/backend/convex/auth/deletion/state";
import { hasCurrentConsent } from "@repo/backend/convex/consents/impl";
import {
  getUnknownErrorMessage,
  runConvexProgram,
} from "@repo/backend/convex/lib/effect";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { Effect, Result, Schema } from "effect";

const productAnalyticsCaptureFailedCode = "PRODUCT_ANALYTICS_CAPTURE_FAILED";
type ProductAnalyticsCtx = Pick<MutationCtx, "db" | "scheduler">;
interface ProductAnalyticsCaptureArgs {
  readonly distinctId: Id<"users">;
  readonly event: ProductAnalyticsEvent;
  readonly timestamp?: Date;
}
interface ProductAnalyticsCaptureOperations {
  readonly capture: () => Effect.Effect<boolean, ProductAnalyticsCaptureError>;
  readonly loadUser: () => Promise<Doc<"users"> | null>;
}
interface ProductAnalyticsDeliveryOperations {
  readonly capture: () => Promise<void>;
  readonly erase: () => Effect.Effect<void, ProductAnalyticsCaptureError>;
  readonly isUserEligible: () => Promise<boolean>;
}
const deliverProductEventReference = makeFunctionReference<
  "action",
  {
    disableGeoip: boolean;
    distinctId: Id<"users">;
    event: string;
    properties?: string;
    timestamp?: number;
  },
  null
>("analytics/capture:deliverProductEvent");
const isProductAnalyticsUserEligibleReference = makeFunctionReference<
  "query",
  {
    userId: Id<"users">;
  },
  boolean
>("analytics/capture:isProductAnalyticsUserEligible");
/** Raised when an admitted backend product event cannot be queued. */
export class ProductAnalyticsCaptureError extends Schema.TaggedError<ProductAnalyticsCaptureError>()(
  "ProductAnalyticsCaptureError",
  {
    code: Schema.Literal(productAnalyticsCaptureFailedCode),
    message: Schema.String,
  }
) {}
/** Maps one Convex or PostHog failure into the analytics capture channel. */
function toProductAnalyticsCaptureError(error: unknown) {
  return new ProductAnalyticsCaptureError({
    code: productAnalyticsCaptureFailedCode,
    message: getUnknownErrorMessage(error),
  });
}
/** Checks the exact current analytics grant before any event can be queued. */
const hasProductAnalyticsConsent = Effect.fn(
  "analytics.capture.hasProductAnalyticsConsent"
)(function* (
  ctx: Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">,
  userId: Id<"users">
) {
  return yield* hasCurrentConsent(ctx, userId, ANALYTICS_CONSENT_CATEGORY).pipe(
    Effect.mapError(toProductAnalyticsCaptureError)
  );
});
/** Queues one backend event behind deletion-aware PostHog delivery. */
export const captureProductEvent = Effect.fn(
  "analytics.capture.captureProductEvent"
)(function* (
  ctx: ProductAnalyticsCtx,
  { distinctId, event, timestamp }: ProductAnalyticsCaptureArgs
) {
  if (!(yield* hasProductAnalyticsConsent(ctx, distinctId))) {
    return false;
  }

  yield* Effect.tryPromise({
    catch: toProductAnalyticsCaptureError,
    try: () =>
      ctx.scheduler.runAfter(0, deliverProductEventReference, {
        disableGeoip: true,
        distinctId,
        event: event.name,
        properties: JSON.stringify(event.properties),
        timestamp: timestamp?.getTime(),
      }),
  });
  return true;
});
/** Delivers only for eligible users and erases writes overlapping withdrawal. */
export const deliverProductAnalyticsProgram = Effect.fn(
  "analytics.capture.deliverProductAnalytics"
)(function* (operations: ProductAnalyticsDeliveryOperations) {
  const isEligibleBeforeSend = yield* Effect.tryPromise({
    catch: toProductAnalyticsCaptureError,
    try: operations.isUserEligible,
  });
  if (!isEligibleBeforeSend) {
    return;
  }
  const captureResult = yield* Effect.result(
    Effect.tryPromise({
      catch: toProductAnalyticsCaptureError,
      try: operations.capture,
    })
  );
  const eligibilityAfterSend = yield* Effect.result(
    Effect.tryPromise({
      catch: toProductAnalyticsCaptureError,
      try: operations.isUserEligible,
    })
  );
  if (Result.isFailure(eligibilityAfterSend)) {
    yield* operations.erase();
    return yield* eligibilityAfterSend.failure;
  }
  if (!eligibilityAfterSend.success) {
    yield* operations.erase();
  }
  if (Result.isFailure(captureResult)) {
    return yield* captureResult.failure;
  }
});
/** Returns the latest consent and deletion-aware state for one app user. */
export const isProductAnalyticsUserEligible = internalQuery({
  args: {
    userId: vv.id("users"),
  },
  returns: v.boolean(),
  handler: (ctx, args) =>
    runConvexProgram(
      Effect.gen(function* () {
        const user = yield* Effect.tryPromise({
          catch: toProductAnalyticsCaptureError,
          try: () => ctx.db.get("users", args.userId),
        });
        if (!user || isAccountDeletionPending(user)) {
          return false;
        }

        return yield* hasProductAnalyticsConsent(ctx, args.userId);
      })
    ),
});
/** Sends one queued event and reconciles deletion that overlaps its IO. */
export const deliverProductEvent = internalAction({
  args: {
    disableGeoip: v.boolean(),
    distinctId: vv.id("users"),
    event: v.string(),
    properties: v.optional(v.string()),
    timestamp: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await runConvexProgram(
      deliverProductAnalyticsProgram({
        capture: () =>
          ctx.runAction(components.posthog.lib.capture, {
            disableGeoip: args.disableGeoip,
            distinctId: args.distinctId,
            event: args.event,
            properties: args.properties,
            timestamp: args.timestamp,
          }),
        erase: () =>
          deletePostHogPerson(args.distinctId).pipe(
            Effect.mapError(toProductAnalyticsCaptureError)
          ),
        isUserEligible: () =>
          ctx.runQuery(isProductAnalyticsUserEligibleReference, {
            userId: args.distinctId,
          }),
      })
    );
    return null;
  },
});
/** Re-enters mutation ordering before admitting an action-owned event. */
export const captureActionProductEventProgram = Effect.fn(
  "analytics.capture.captureActionProductEvent"
)(function* (
  ctx: MutationCtx,
  args: ProductAnalyticsCaptureArgs,
  operations: ProductAnalyticsCaptureOperations = {
    capture: () => captureProductEvent(ctx, args),
    loadUser: () => ctx.db.get("users", args.distinctId),
  }
) {
  const user = yield* Effect.tryPromise({
    catch: toProductAnalyticsCaptureError,
    try: operations.loadUser,
  });
  if (!user || isAccountDeletionPending(user)) {
    return false;
  }
  return yield* operations.capture();
});
/** Mutation boundary for action-owned analytics events. */
export const captureActionProductEvent = internalMutation({
  args: {
    distinctId: vv.id("users"),
    event: productAnalyticsEventValidator,
    timestamp: v.optional(v.number()),
  },
  returns: v.boolean(),
  handler: (ctx, args) =>
    runConvexProgram(
      captureActionProductEventProgram(ctx, {
        distinctId: args.distinctId,
        event: args.event,
        timestamp:
          args.timestamp === undefined ? undefined : new Date(args.timestamp),
      })
    ),
});
