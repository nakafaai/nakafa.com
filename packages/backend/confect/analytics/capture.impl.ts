import { FunctionImpl, GroupImpl } from "@confect/server";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  ActionCtx as ActionCtxService,
  DatabaseReader,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import {
  deliverProductAnalyticsProgram,
  hasProductAnalyticsConsent,
  ProductAnalyticsDeliveryOperations,
  toProductAnalyticsCaptureError,
} from "@repo/backend/confect/analytics/capture";
import spec from "@repo/backend/confect/analytics/capture.spec";
import { requestAnalyticsErasure } from "@repo/backend/confect/analytics/erasure/request";
import { isAccountDeletionPending } from "@repo/backend/confect/auth/deletion/state";
import { Effect, flow, Layer, Struct } from "effect";

const isProductAnalyticsUserEligible = FunctionImpl.make(
  databaseSchema,
  spec,
  "isProductAnalyticsUserEligible",
  Effect.fn("analytics.capture.isProductAnalyticsUserEligible")(
    function* (args) {
      return yield* Effect.gen(function* () {
        const database = yield* DatabaseReader;
        const user = yield* database
          .table("users")
          .get(args.userId)
          .pipe(
            Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
            Effect.orDie
          );
        if (!user || isAccountDeletionPending(user)) {
          return false;
        }
        return yield* hasProductAnalyticsConsent(args.userId);
      }).pipe(
        Effect.catchDefect(flow(toProductAnalyticsCaptureError, Effect.fail))
      );
    }
  )
);
const deliverProductEvent = FunctionImpl.make(
  databaseSchema,
  spec,
  "deliverProductEvent",
  Effect.fn("analytics.capture.deliverProductEvent")(function* (args) {
    const ctx = yield* ActionCtxService;
    const { runQuery } = yield* QueryRunner;
    yield* deliverProductAnalyticsProgram().pipe(
      Effect.provideService(ProductAnalyticsDeliveryOperations, {
        capture: Effect.tryPromise({
          try: () =>
            ctx.runAction(components.posthog.lib.capture, {
              disableGeoip: args.disableGeoip,
              distinctId: args.distinctId,
              event: args.event,
              ...Struct.pick(args, ["properties"]),
              ...Struct.pick(args, ["timestamp"]),
            }),
          catch: toProductAnalyticsCaptureError,
        }),
        isUserEligible: runQuery(
          refs.internal.analytics.capture.isProductAnalyticsUserEligible,
          {
            userId: args.distinctId,
          }
        ).pipe(
          Effect.mapError(toProductAnalyticsCaptureError),
          Effect.catchDefect(flow(toProductAnalyticsCaptureError, Effect.fail))
        ),
        requestErasure: requestAnalyticsErasure(args.distinctId).pipe(
          Effect.mapError(toProductAnalyticsCaptureError),
          Effect.provideService(ActionCtxService, ctx)
        ),
      })
    );
    return null;
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(isProductAnalyticsUserEligible),
  Layer.provide(deliverProductEvent),
  GroupImpl.finalize
);
