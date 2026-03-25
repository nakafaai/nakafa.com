import { query } from "@repo/backend/convex/_generated/server";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import {
  loadLatestUserTryoutContext,
  loadTryoutPartRuntime,
} from "@repo/backend/convex/tryouts/queries/me/helpers";
import {
  tryoutPartAttemptRuntimeValidator,
  userTryoutLookupArgs,
} from "@repo/backend/convex/tryouts/queries/me/validators";
import { tryoutPartKeyValidator } from "@repo/backend/convex/tryouts/schema";
import { v } from "convex/values";
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

    const runtime = await loadTryoutPartRuntime(ctx, {
      partKey: args.partKey,
      tryoutAttemptId: tryoutAttempt._id,
    });

    if (!runtime) {
      return {
        expiresAtMs: tryoutAttempt.expiresAt,
        partAttempt: null,
        tryoutAttempt,
      };
    }

    return {
      expiresAtMs: tryoutAttempt.expiresAt,
      partAttempt: {
        partIndex: runtime.partIndex,
        partKey: runtime.partKey,
        answers: runtime.answers,
        setAttempt: runtime.setAttempt,
      },
      tryoutAttempt,
    };
  },
});
