import { components } from "@repo/backend/convex/_generated/api";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "@repo/backend/convex/_generated/server";
import { deletePostHogPerson } from "@repo/backend/convex/analytics/deletion";
import {
  type ProductAnalyticsEvent,
  productAnalyticsEventValidator,
} from "@repo/backend/convex/analytics/events";
import { isAccountDeletionPending } from "@repo/backend/convex/auth/deletion/state";
import {
  getUnknownErrorMessage,
  runConvexProgram,
} from "@repo/backend/convex/lib/effect";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import {
  type UserPlan,
  userPlanValidator,
} from "@repo/backend/convex/users/schema";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { Effect, Either, Schema } from "effect";

const productAnalyticsCaptureFailedCode = "PRODUCT_ANALYTICS_CAPTURE_FAILED";

type ProductAnalyticsCtx = Pick<MutationCtx, "scheduler">;

interface ProductAnalyticsCaptureArgs {
  readonly distinctId: Id<"users">;
  readonly event: ProductAnalyticsEvent;
  readonly timestamp?: Date;
}

interface ProductAnalyticsIdentifyArgs {
  readonly distinctId: Id<"users">;
  readonly email: string;
  readonly name: string;
  readonly plan: UserPlan;
  readonly signedUpAt: string;
}

interface ProductAnalyticsCaptureOperations {
  readonly capture: () => Effect.Effect<void, ProductAnalyticsCaptureError>;
  readonly loadUser: () => Promise<Doc<"users"> | null>;
}

interface ProductAnalyticsDeliveryOperations {
  readonly capture: () => Promise<void>;
  readonly erase: () => Effect.Effect<void, ProductAnalyticsCaptureError>;
  readonly isUserActive: () => Promise<boolean>;
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
const deliverProductIdentifyReference = makeFunctionReference<
  "action",
  {
    distinctId: Id<"users">;
    email: string;
    name: string;
    plan: UserPlan;
    signedUpAt: string;
  },
  null
>("analytics/capture:deliverProductIdentify");
const isProductAnalyticsUserActiveReference = makeFunctionReference<
  "query",
  { userId: Id<"users"> },
  boolean
>("analytics/capture:isProductAnalyticsUserActive");

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

/** Queues one backend event behind deletion-aware PostHog delivery. */
export const captureProductEvent = Effect.fn(
  "analytics.capture.captureProductEvent"
)(function* (
  ctx: ProductAnalyticsCtx,
  { distinctId, event, timestamp }: ProductAnalyticsCaptureArgs
) {
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
});

/** Queues signup identification behind the same deletion-aware delivery gate. */
export const identifyProductUser = Effect.fn(
  "analytics.capture.identifyProductUser"
)(function* (ctx: ProductAnalyticsCtx, args: ProductAnalyticsIdentifyArgs) {
  yield* Effect.tryPromise({
    catch: toProductAnalyticsCaptureError,
    try: () => ctx.scheduler.runAfter(0, deliverProductIdentifyReference, args),
  });
});

/** Delivers only for active users and erases writes overlapping deletion. */
export const deliverProductAnalyticsProgram = Effect.fn(
  "analytics.capture.deliverProductAnalytics"
)(function* (operations: ProductAnalyticsDeliveryOperations) {
  const isActiveBeforeSend = yield* Effect.tryPromise({
    catch: toProductAnalyticsCaptureError,
    try: operations.isUserActive,
  });

  if (!isActiveBeforeSend) {
    return;
  }

  const captureResult = yield* Effect.either(
    Effect.tryPromise({
      catch: toProductAnalyticsCaptureError,
      try: operations.capture,
    })
  );
  const isActiveAfterSend = yield* Effect.tryPromise({
    catch: toProductAnalyticsCaptureError,
    try: operations.isUserActive,
  });

  if (!isActiveAfterSend) {
    yield* operations.erase();
  }

  if (Either.isLeft(captureResult)) {
    return yield* captureResult.left;
  }
});

/** Returns the latest deletion-aware admission state for one app user. */
export const isProductAnalyticsUserActive = internalQuery({
  args: {
    userId: vv.id("users"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId);
    return user !== null && !isAccountDeletionPending(user);
  },
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
        isUserActive: () =>
          ctx.runQuery(isProductAnalyticsUserActiveReference, {
            userId: args.distinctId,
          }),
      })
    );

    return null;
  },
});

/** Identifies one signup without allowing a delayed job to revive deleted data. */
export const deliverProductIdentify = internalAction({
  args: {
    distinctId: vv.id("users"),
    email: v.string(),
    name: v.string(),
    plan: userPlanValidator,
    signedUpAt: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await runConvexProgram(
      deliverProductAnalyticsProgram({
        capture: () =>
          ctx.runAction(components.posthog.lib.identify, {
            disableGeoip: true,
            distinctId: args.distinctId,
            properties: JSON.stringify({
              $set: {
                email: args.email,
                name: args.name,
                plan: args.plan,
              },
              $set_once: {
                signed_up_at: args.signedUpAt,
              },
            }),
          }),
        erase: () =>
          deletePostHogPerson(args.distinctId).pipe(
            Effect.mapError(toProductAnalyticsCaptureError)
          ),
        isUserActive: () =>
          ctx.runQuery(isProductAnalyticsUserActiveReference, {
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
    return;
  }

  yield* operations.capture();
});

/** Mutation boundary for action-owned analytics events. */
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
