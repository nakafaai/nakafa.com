import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { MutationCtx as MutationCtxService } from "@repo/backend/confect/_generated/services";
import { captureProductEvent } from "@repo/backend/confect/analytics/capture";
import { requireAuth } from "@repo/backend/confect/auth/session";
import spec from "@repo/backend/confect/tryouts/mutations/access.spec";
import { Clock, Effect, Layer } from "effect";

/** Records one authenticated view of the try-out upgrade dialog. */
const trackPaywallView = FunctionImpl.make(
  databaseSchema,
  spec,
  "trackPaywallView",
  Effect.fn("tryouts.mutations.access.trackPaywallView")(function* (args) {
    const ctx = yield* MutationCtxService;
    return yield* Effect.gen(function* () {
      const { appUser } = yield* requireAuth(ctx);
      const now = yield* Clock.currentTimeMillis;
      yield* captureProductEvent(ctx, {
        distinctId: appUser._id,
        event: {
          name: "tryout paywall viewed",
          properties: {
            source: args.source,
          },
        },
        timestamp: new Date(now),
      });
      return null;
    });
  })
);
export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(trackPaywallView),
  GroupImpl.finalize
);
