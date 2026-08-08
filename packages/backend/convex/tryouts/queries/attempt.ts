import { query } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { getOptionalAppUserForRead } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { readLatestAttemptByPath } from "@repo/backend/convex/tryouts/runtime/lookup";
import { v } from "convex/values";
import { Effect } from "effect";

/** Reports whether the active public set route must lock the app shell. */
export const isLockedByPublicPath = query({
  args: {
    locale: localeValidator,
    publicPath: v.string(),
  },
  returns: v.boolean(),
  handler: (ctx, args) =>
    runConvexProgram(
      Effect.gen(function* () {
        const auth = yield* Effect.promise(() =>
          getOptionalAppUserForRead(ctx)
        );
        if (!auth) {
          return false;
        }
        const attempt = yield* readLatestAttemptByPath(
          ctx,
          args,
          auth.appUser._id
        );
        return attempt?.status === "in-progress";
      })
    ),
});
