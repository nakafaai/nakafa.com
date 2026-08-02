import { query } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { getOptionalAppUserForRead } from "@repo/backend/convex/lib/helpers/auth";
import { getTryoutStartAccess } from "@repo/backend/convex/tryouts/access/impl";
import { readTryoutSectionContent } from "@repo/backend/convex/tryouts/runtime/access";
import {
  tryoutSectionContentAccessValidator,
  tryoutSectionContentArgs,
} from "@repo/backend/convex/tryouts/runtime/content";
import {
  startAccessArgsValidator,
  toTryoutStartError,
  tryoutStartAccessValidator,
} from "@repo/backend/convex/tryouts/start/spec";
import type { Infer } from "convex/values";
import { Effect } from "effect";

const anonymousStartAccess: Infer<typeof tryoutStartAccessValidator> = {
  kind: "free-attempt",
};

/** Returns the advisory access state for the try-out start dialog. */
export const getStartAccess = query({
  args: startAccessArgsValidator,
  returns: tryoutStartAccessValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      Effect.gen(function* () {
        const auth = yield* Effect.tryPromise({
          catch: toTryoutStartError,
          try: () => getOptionalAppUserForRead(ctx),
        });

        if (!auth) {
          return anonymousStartAccess;
        }

        return yield* getTryoutStartAccess(ctx, {
          ...args,
          userId: auth.appUser._id,
        });
      })
    ),
});

/** Authorizes server-rendered content for the current user's owned runtime. */
export const getSectionContent = query({
  args: tryoutSectionContentArgs,
  returns: tryoutSectionContentAccessValidator,
  handler: (ctx, args) => runConvexProgram(readTryoutSectionContent(ctx, args)),
});
