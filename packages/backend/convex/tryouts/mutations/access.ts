import { captureProductEvent } from "@repo/backend/convex/analytics/capture";
import { mutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import {
  toTryoutStartError,
  tryoutPaywallSourceValidator,
} from "@repo/backend/convex/tryouts/start/spec";
import { v } from "convex/values";
import { Clock, Effect } from "effect";

/** Records one authenticated view of the try-out upgrade dialog. */
export const trackPaywallView = mutation({
  args: {
    source: tryoutPaywallSourceValidator,
  },
  returns: v.null(),
  handler: (ctx, args) =>
    runConvexProgram(
      Effect.gen(function* () {
        const { appUser } = yield* Effect.tryPromise({
          catch: toTryoutStartError,
          try: () => requireAuth(ctx),
        });
        const now = yield* Clock.currentTimeMillis;

        yield* Effect.tryPromise({
          catch: toTryoutStartError,
          try: () =>
            captureProductEvent(ctx, {
              distinctId: appUser._id,
              event: {
                name: "tryout paywall viewed",
                properties: { source: args.source },
              },
              timestamp: new Date(now),
            }),
        });

        return null;
      })
    ),
});
