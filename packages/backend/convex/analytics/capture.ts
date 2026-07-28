import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import {
  internalMutation,
  type MutationCtx,
} from "@repo/backend/convex/_generated/server";
import {
  type ProductAnalyticsEvent,
  productAnalyticsEventValidator,
} from "@repo/backend/convex/analytics/events";
import {
  getUnknownErrorMessage,
  runConvexProgram,
} from "@repo/backend/convex/lib/effect";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { posthog } from "@repo/backend/convex/posthog";
import { v } from "convex/values";
import { Effect, Schema } from "effect";

const productAnalyticsCaptureFailedCode = "PRODUCT_ANALYTICS_CAPTURE_FAILED";

type ProductAnalyticsCtx = Pick<MutationCtx, "scheduler">;

interface ProductAnalyticsCaptureArgs {
  readonly distinctId: Id<"users">;
  readonly event: ProductAnalyticsEvent;
  readonly timestamp?: Date;
}

interface ProductAnalyticsCaptureOperations {
  readonly capture: () => Promise<void>;
  readonly loadUser: () => Promise<Doc<"users"> | null>;
}

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

/**
 * Capture one backend product event through the official PostHog Convex
 * component.
 */
export async function captureProductEvent(
  ctx: ProductAnalyticsCtx,
  { distinctId, event, timestamp }: ProductAnalyticsCaptureArgs
) {
  await posthog.capture(ctx, {
    distinctId,
    disableGeoip: true,
    event: event.name,
    properties: event.properties,
    timestamp,
  });
}

/**
 * Re-enters mutation ordering after a long-running action and admits its event
 * only while the app user remains active.
 */
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

  if (!user || user.deletedAt !== undefined) {
    return;
  }

  yield* Effect.tryPromise({
    catch: toProductAnalyticsCaptureError,
    try: operations.capture,
  });
});

/**
 * Re-enters mutation ordering after a long-running action before queuing its
 * analytics event.
 */
export const captureActionProductEvent = internalMutation({
  args: {
    distinctId: vv.id("users"),
    event: productAnalyticsEventValidator,
    timestamp: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await runConvexProgram(
      captureActionProductEventProgram(ctx, {
        distinctId: args.distinctId,
        event: args.event,
        timestamp:
          args.timestamp === undefined ? undefined : new Date(args.timestamp),
      })
    );

    return null;
  },
});
