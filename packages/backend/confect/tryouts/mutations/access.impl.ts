import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { captureProductEvent } from "@repo/backend/confect/analytics/capture";
import { requireAuth } from "@repo/backend/confect/auth/session";
import sessionMiddleware from "@repo/backend/confect/middleware/session.impl";
import spec from "@repo/backend/confect/tryouts/mutations/access.spec";
import { Clock, Effect, Layer } from "effect";

/** Records one authenticated view of the try-out upgrade dialog. */
const trackPaywallView = FunctionImpl.make(
  databaseSchema,
  spec,
  "trackPaywallView",
  Effect.fn("tryouts.mutations.access.trackPaywallView")(function* (args) {
    return yield* Effect.gen(function* () {
      const { appUser } = yield* requireAuth();
      const now = yield* Clock.currentTimeMillis;
      yield* captureProductEvent({
        distinctId: appUser._id,
        event: {
          name: "tryout paywall viewed",
          properties: {
            source: args.source,
          },
        },
        timestamp: now,
      });
      return null;
    });
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(trackPaywallView),
  Layer.provide(sessionMiddleware),
  GroupImpl.finalize
);
