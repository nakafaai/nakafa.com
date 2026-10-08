import { ANALYTICS_CONSENT_CATEGORY } from "@repo/analytics/consent";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
import { Scheduler } from "@repo/backend/confect/_generated/services";
import {
  ProductAnalyticsCaptureError,
  productAnalyticsCaptureFailedCode,
} from "@repo/backend/confect/analytics/capture.spec";
import { productAnalyticsEventValidator } from "@repo/backend/confect/analytics/events";
import { hasCurrentConsent } from "@repo/backend/confect/consents/impl";
import { getUnknownErrorMessage } from "@repo/backend/confect/failure";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Duration, Effect, flow, Result, Schema } from "effect";

const JsonText = Schema.fromJsonString(Schema.Unknown);
export type ProductAnalyticsCtx = Pick<MutationCtx, "db" | "scheduler">;
const ProductAnalyticsCaptureArgsSchema = Schema.Struct({
  distinctId: IdSchema("users"),
  event: productAnalyticsEventValidator,
  timestamp: Schema.optionalKey(Schema.Date),
});
export type ProductAnalyticsCaptureArgs =
  typeof ProductAnalyticsCaptureArgsSchema.Type;
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
)(function* (userId: Id<"users">) {
  return yield* hasCurrentConsent(userId, ANALYTICS_CONSENT_CATEGORY).pipe(
    Effect.mapError(toProductAnalyticsCaptureError)
  );
});
/** Queues one backend event behind deletion-aware PostHog delivery. */
export const captureProductEvent = Effect.fn(
  "analytics.capture.captureProductEvent"
)(
  function* ({ distinctId, event, timestamp }: ProductAnalyticsCaptureArgs) {
    const scheduler = yield* Scheduler;
    if (!(yield* hasProductAnalyticsConsent(distinctId))) {
      return;
    }
    const properties = yield* Schema.encodeEffect(JsonText)(
      event.properties
    ).pipe(Effect.orDie);
    yield* scheduler
      .runAfter(
        Duration.millis(0),
        refs.internal.analytics.capture.deliverProductEvent,
        {
          disableGeoip: true,
          distinctId,
          event: event.name,
          properties,
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
)(function* <R>(operations: {
  readonly capture: Effect.Effect<void, ProductAnalyticsCaptureError, R>;
  readonly isUserEligible: Effect.Effect<
    boolean,
    ProductAnalyticsCaptureError,
    R
  >;
  readonly requestErasure: Effect.Effect<void, ProductAnalyticsCaptureError, R>;
}) {
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
