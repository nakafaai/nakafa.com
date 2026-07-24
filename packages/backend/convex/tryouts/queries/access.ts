import { query } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { getOptionalAppUser } from "@repo/backend/convex/lib/helpers/auth";
import { getTryoutStartAccess } from "@repo/backend/convex/tryouts/access/impl";
import {
  startAccessArgsValidator,
  toTryoutStartError,
  tryoutStartAccessValidator,
} from "@repo/backend/convex/tryouts/start/spec";
import { Effect } from "effect";

/** Returns the advisory access state for the try-out start dialog. */
export const getStartAccess = query({
  args: startAccessArgsValidator,
  returns: tryoutStartAccessValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      Effect.gen(function* () {
        const auth = yield* Effect.tryPromise({
          catch: toTryoutStartError,
          try: () => getOptionalAppUser(ctx),
        });

        if (!auth) {
          return { kind: "free-attempt" } as const;
        }

        return yield* getTryoutStartAccess(ctx, {
          ...args,
          userId: auth.appUser._id,
        });
      })
    ),
});
