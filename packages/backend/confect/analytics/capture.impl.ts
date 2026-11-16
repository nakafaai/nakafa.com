import { FunctionImpl, GroupImpl } from "@confect/server";
import { components } from "@repo/backend/confect/_generated/components";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { ActionCtx as ActionCtxService } from "@repo/backend/confect/_generated/services";
import { toProductAnalyticsCaptureError } from "@repo/backend/confect/analytics/capture";
import spec from "@repo/backend/confect/analytics/capture.spec";
import { randomUuid } from "@repo/utilities/uuid";
import { Effect, flow, Layer } from "effect";

/**
 * Sends one product event to PostHog without a person: a fresh distinct id for
 * the event alone, the properties that turn PostHog's person profile off, and no
 * location, so the event joins no account and no other event.
 */
const deliverProductEvent = FunctionImpl.make(
  databaseSchema,
  spec,
  "deliverProductEvent",
  Effect.fn("analytics.capture.deliverProductEvent")(function* (args) {
    const ctx = yield* ActionCtxService;
    const distinctId = yield* randomUuid;
    yield* Effect.tryPromise({
      try: () =>
        ctx.runAction(components.posthog.lib.capture, {
          disableGeoip: true,
          distinctId,
          event: args.event,
          ...(args.properties === undefined
            ? {}
            : { properties: args.properties }),
          ...(args.timestamp === undefined
            ? {}
            : { timestamp: args.timestamp }),
        }),
      catch: toProductAnalyticsCaptureError,
    }).pipe(
      Effect.catchDefect(flow(toProductAnalyticsCaptureError, Effect.fail))
    );
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(deliverProductEvent),
  GroupImpl.finalize
);
