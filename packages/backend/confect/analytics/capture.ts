import { Scheduler } from "@confect/server";
import { ANALYTICS_CONSENT_CATEGORY } from "@repo/analytics/consent";
import refs from "@repo/backend/confect/_generated/refs";
import {
  ProductAnalyticsCaptureError,
  productAnalyticsCaptureFailedCode,
} from "@repo/backend/confect/analytics/capture.spec";
import type { ProductAnalyticsEvent } from "@repo/backend/confect/analytics/events";
import { hasCurrentConsent } from "@repo/backend/confect/consents/impl";
import { getUnknownErrorMessage } from "@repo/backend/confect/failure";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { Duration, Effect, flow, Result } from "effect";
export type ProductAnalyticsCtx = Pick<MutationCtx, "db" | "scheduler">;
export interface ProductAnalyticsCaptureArgs {
  readonly distinctId: Id<"users">;
  readonly event: ProductAnalyticsEvent;
  readonly timestamp?: Date;
}
export interface ProductAnalyticsDeliveryOperations {
  readonly capture: Effect.Effect<void, ProductAnalyticsCaptureError>;
  readonly isUserEligible: Effect.Effect<boolean, ProductAnalyticsCaptureError>;
  readonly requestErasure: Effect.Effect<void, ProductAnalyticsCaptureError>;
}
/** Raised when an admitted backend product event cannot be queued. */
/** Maps one Convex or PostHog failure into the analytics capture channel. */
export function toProductAnalyticsCaptureError(error: unknown) {
  return new ProductAnalyticsCaptureError({
    code: productAnalyticsCaptureFailedCode,
    message: getUnknownErrorMessage(error),
  });
}
/** Checks the exact current analytics grant before any event can be queued. */
export const hasProductAnalyticsConsent = Effect.fn(
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
)(
  function* (
    ctx: ProductAnalyticsCtx,
    { distinctId, event, timestamp }: ProductAnalyticsCaptureArgs
  ) {
    const scheduler = yield* Scheduler.Scheduler.pipe(
      Effect.provide(Scheduler.layer(ctx.scheduler))
    );
    if (!(yield* hasProductAnalyticsConsent(ctx, distinctId))) {
      return;
    }
    yield* scheduler
      .runAfter(
        Duration.millis(0),
        refs.internal.analytics.capture.deliverProductEvent,
        {
          disableGeoip: true,
          distinctId,
          event: event.name,
          properties: JSON.stringify(event.properties),
          ...(timestamp === undefined
            ? {}
            : {
                timestamp: timestamp.getTime(),
              }),
        }
      )
      .pipe(
        Effect.catchDefect(flow(toProductAnalyticsCaptureError, Effect.fail))
      );
  },
  Effect.catchTag("ProductAnalyticsCaptureError", (error) =>
    Effect.logWarning("Optional product analytics capture failed.").pipe(
      Effect.annotateLogs({
        code: error.code,
      })
    )
  )
);
/** Delivers only for eligible users and erases writes overlapping withdrawal. */
export const deliverProductAnalyticsProgram = Effect.fn(
  "analytics.capture.deliverProductAnalytics"
)(function* (operations: ProductAnalyticsDeliveryOperations) {
  const isEligibleBeforeSend = yield* operations.isUserEligible;
  if (!isEligibleBeforeSend) {
    return;
  }
  const captureResult = yield* Effect.result(operations.capture);
  const eligibilityAfterSend = yield* Effect.result(operations.isUserEligible);
  if (Result.isFailure(eligibilityAfterSend)) {
    yield* operations.requestErasure;
    return yield* eligibilityAfterSend.failure;
  }
  if (!eligibilityAfterSend.success) {
    yield* operations.requestErasure;
  }
  if (Result.isFailure(captureResult)) {
    return yield* captureResult.failure;
  }
});
