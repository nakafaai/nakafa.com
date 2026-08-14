import { ensureTryoutLifecycleWritable } from "@repo/backend/convex/contentRelease/cutover/tryouts";
import { mutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { saveTryoutResponse } from "@repo/backend/convex/tryouts/response/impl";
import {
  saveTryoutResponseArgsValidator,
  saveTryoutResponseResultValidator,
  toTryoutResponseError,
} from "@repo/backend/convex/tryouts/response/spec";
import { Clock, Effect } from "effect";

/** Saves one placement choice with server-owned timing and integrity checks. */
export const save = mutation({
  args: saveTryoutResponseArgsValidator,
  returns: saveTryoutResponseResultValidator,
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
        const now = yield* Clock.currentTimeMillis;

        return yield* saveTryoutResponse(ctx, {
          args,
          now,
          userId: appUser._id,
        });
      })
    ),
});
