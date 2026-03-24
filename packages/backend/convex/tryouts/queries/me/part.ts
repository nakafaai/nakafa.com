import { query } from "@repo/backend/convex/_generated/server";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { loadLatestUserTryoutContext } from "@repo/backend/convex/tryouts/queries/me/helpers";
import {
  tryoutPartAttemptRuntimeValidator,
  userTryoutLookupArgs,
} from "@repo/backend/convex/tryouts/queries/me/validators";
import { tryoutPartKeyValidator } from "@repo/backend/convex/tryouts/schema";
import { ConvexError, v } from "convex/values";
import { getManyFrom } from "convex-helpers/server/relationships";
import { nullable } from "convex-helpers/validators";

/** Returns the authenticated user's runtime state for one tryout part. */
export const getUserTryoutPartAttempt = query({
  args: {
    ...userTryoutLookupArgs,
    partKey: tryoutPartKeyValidator,
  },
  returns: nullable(
    v.object({
      expiresAtMs: v.number(),
      partAttempt: nullable(tryoutPartAttemptRuntimeValidator),
      tryoutAttempt: vv.doc("tryoutAttempts"),
    })
  ),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);
    const context = await loadLatestUserTryoutContext(ctx, {
      ...args,
      userId: appUser._id,
    });

    if (!context) {
      return null;
    }

    const { attempt: tryoutAttempt } = context;

    const currentPartAttempt = await ctx.db
      .query("tryoutPartAttempts")
      .withIndex("by_tryoutAttemptId_and_partKey", (q) =>
        q.eq("tryoutAttemptId", tryoutAttempt._id).eq("partKey", args.partKey)
      )
      .unique();

    if (!currentPartAttempt) {
      return {
        expiresAtMs: tryoutAttempt.expiresAt,
        partAttempt: null,
        tryoutAttempt,
      };
    }

    const setAttempt = await ctx.db.get(
      "exerciseAttempts",
      currentPartAttempt.setAttemptId
    );

    if (!setAttempt) {
      throw new ConvexError({
        code: "INVALID_ATTEMPT_STATE",
        message: "Tryout part is missing its exercise attempt.",
      });
    }

    const answers = await getManyFrom(
      ctx.db,
      "exerciseAnswers",
      "by_attemptId_and_exerciseNumber",
      currentPartAttempt.setAttemptId,
      "attemptId"
    );

    return {
      expiresAtMs: tryoutAttempt.expiresAt,
      partAttempt: {
        partIndex: currentPartAttempt.partIndex,
        partKey: currentPartAttempt.partKey,
        answers,
        setAttempt,
      },
      tryoutAttempt,
    };
  },
});
