import { ensureTryoutLifecycleWritable } from "@repo/backend/convex/contentRelease/cutover/tryouts";
import { mutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { saveTryoutResponse } from "@repo/backend/convex/tryouts/response/impl";
import {
  TryoutResponseError,
  toTryoutResponseError,
} from "@repo/backend/convex/tryouts/response/spec";
import { startTryoutAttempt } from "@repo/backend/convex/tryouts/start/impl";
import {
  startAttemptArgsValidator,
  startAttemptResultValidator,
  toTryoutStartError,
} from "@repo/backend/convex/tryouts/start/spec";
import { v } from "convex/values";
import { Clock, Effect } from "effect";

/** Starts one bounded try-out attempt from synced section and question rows. */
export const startAttempt = mutation({
  args: startAttemptArgsValidator,
  returns: startAttemptResultValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      Effect.gen(function* () {
        yield* ensureTryoutLifecycleWritable(ctx).pipe(
          Effect.mapError(toTryoutStartError)
        );
        const { appUser } = yield* Effect.tryPromise({
          catch: toTryoutStartError,
          try: () => requireAuth(ctx),
        });
        const now = yield* Clock.currentTimeMillis;

        return yield* startTryoutAttempt(ctx, {
          args,
          now,
          userId: appUser._id,
        });
      })
    ),
});

/** Saves one selected multiple-choice answer for a try-out placement. */
export const saveResponse = mutation({
  args: {
    placementId: v.id("tryoutAttemptPlacements"),
    selectedOptionId: v.optional(v.string()),
    timeSpent: v.number(),
  },
  returns: v.null(),
  handler: (ctx, args) =>
    runConvexProgram(
      Effect.gen(function* () {
        yield* ensureTryoutLifecycleWritable(ctx).pipe(
          Effect.mapError(toTryoutResponseError)
        );
        const { appUser } = yield* Effect.tryPromise({
          catch: toTryoutResponseError,
          try: () => requireAuth(ctx),
        });
        if (!args.selectedOptionId) {
          return yield* new TryoutResponseError({
            code: "TRYOUT_CHOICE_REQUIRED",
            message: "Try-out selected choice is required.",
          });
        }
        const now = yield* Clock.currentTimeMillis;

        return yield* saveTryoutResponse(ctx, {
          args: {
            placementId: args.placementId,
            selectedOptionId: args.selectedOptionId,
          },
          now,
          userId: appUser._id,
        });
      })
    ),
});
