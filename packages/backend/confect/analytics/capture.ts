import analyticsInternal from "@repo/backend/confect/_generated/refs/analytics.server";
import { Scheduler } from "@repo/backend/confect/_generated/services";
import {
  ProductAnalyticsCaptureError,
  productAnalyticsCaptureFailedCode,
} from "@repo/backend/confect/analytics/capture.spec";
import { productAnalyticsEventValidator } from "@repo/backend/confect/analytics/events";
import { getUnknownErrorMessage } from "@repo/backend/confect/failure";
import { JsonTextSchema } from "@repo/utilities/json";
import { Duration, Effect, flow, Schema } from "effect";

const ProductAnalyticsCaptureArgsSchema = Schema.Struct({
  event: productAnalyticsEventValidator,
  /** Event time as epoch milliseconds. */
  timestamp: Schema.optionalKey(Schema.Finite),
});
type ProductAnalyticsCaptureArgs =
  typeof ProductAnalyticsCaptureArgsSchema.Type;

/** Maps one Convex or PostHog failure into the analytics capture channel. */
export function toProductAnalyticsCaptureError(error: unknown) {
  return new ProductAnalyticsCaptureError({
    code: productAnalyticsCaptureFailedCode,
    message: getUnknownErrorMessage(error),
  });
}

/**
 * Queues one backend product event for PostHog, anonymous: it names no account
 * and builds no person, so the counts and funnels of an event's properties stay
 * while no server event identifies anyone. Google's consent mode, which governs
 * identified analytics, lives in the browser, where the server cannot read it.
 * A failure to queue is logged, never raised, because the event is optional.
 */
export const captureProductEvent = Effect.fn(
  "analytics.capture.captureProductEvent"
)(
  function* ({ event, timestamp }: ProductAnalyticsCaptureArgs) {
    const scheduler = yield* Scheduler;
    // PostHog builds no person from an event that turns this off.
    const properties = yield* Schema.encodeEffect(JsonTextSchema)({
      ...event.properties,
      $process_person_profile: false,
    }).pipe(Effect.orDie);
    yield* scheduler
      .runAfter(
        Duration.millis(0),
        analyticsInternal.capture.deliverProductEvent,
        {
          event: event.name,
          properties,
          ...(timestamp === undefined ? {} : { timestamp }),
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
