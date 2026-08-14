import { mutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { startTryoutAttempt } from "@repo/backend/convex/tryouts/start/impl";
import {
  startAttemptArgsValidator,
  startAttemptResultValidator,
  toTryoutStartError,
} from "@repo/backend/convex/tryouts/start/spec";
import { Clock, Effect } from "effect";

/** Starts one bounded try-out attempt from synced section and question rows. */
export const startAttempt = mutation({
  args: startAttemptArgsValidator,
  returns: startAttemptResultValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      Effect.gen(function* () {
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
