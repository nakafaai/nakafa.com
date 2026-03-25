import { query } from "@repo/backend/convex/_generated/server";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { loadBoundedTryoutPartAttempts } from "@repo/backend/convex/tryouts/helpers/loaders";
import { loadValidatedTryoutPartSets } from "@repo/backend/convex/tryouts/helpers/parts";
import {
  loadLatestUserTryoutContext,
  resolveResumePartKey,
} from "@repo/backend/convex/tryouts/queries/me/helpers";
import {
  orderedTryoutPartValidator,
  tryoutPartAttemptSummaryValidator,
  userTryoutLookupArgs,
} from "@repo/backend/convex/tryouts/queries/me/validators";
import { tryoutPartKeyValidator } from "@repo/backend/convex/tryouts/schema";
import { ConvexError, v } from "convex/values";
import { getAll } from "convex-helpers/server/relationships";
import { nullable } from "convex-helpers/validators";

/** Returns the authenticated user's latest tryout attempt for one tryout slug. */
export const getUserTryoutAttempt = query({
  args: userTryoutLookupArgs,
  returns: nullable(
    v.object({
      attempt: vv.doc("tryoutAttempts"),
      orderedParts: v.array(orderedTryoutPartValidator),
      partAttempts: v.array(tryoutPartAttemptSummaryValidator),
      resumePartKey: v.optional(tryoutPartKeyValidator),
      expiresAtMs: v.number(),
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

    const { attempt, tryout } = context;

    const [tryoutPartSets, tryoutPartAttempts] = await Promise.all([
      loadValidatedTryoutPartSets(ctx.db, {
        partCount: tryout.partCount,
        tryoutId: tryout._id,
      }),
      loadBoundedTryoutPartAttempts(ctx.db, {
        partCount: tryout.partCount,
        tryoutAttemptId: attempt._id,
      }),
    ]);
    const orderedParts = tryoutPartSets.map((tryoutPartSet) => ({
      partIndex: tryoutPartSet.partIndex,
      partKey: tryoutPartSet.partKey,
    }));
    const setAttempts = await getAll(
      ctx.db,
      "exerciseAttempts",
      tryoutPartAttempts.map((partAttempt) => partAttempt.setAttemptId)
    );
    const partAttempts = tryoutPartAttempts.map(
      (partAttempt: (typeof tryoutPartAttempts)[number], index: number) => {
        const setAttempt = setAttempts[index];

        if (!setAttempt) {
          throw new ConvexError({
            code: "INVALID_ATTEMPT_STATE",
            message: "Part attempt is missing its exercise attempt.",
          });
        }

        return {
          partIndex: partAttempt.partIndex,
          partKey: partAttempt.partKey,
          setAttempt: {
            lastActivityAt: setAttempt.lastActivityAt,
            startedAt: setAttempt.startedAt,
            status: setAttempt.status,
            timeLimit: setAttempt.timeLimit,
          },
        };
      }
    );

    if (attempt.status !== "in-progress") {
      return {
        attempt,
        orderedParts,
        partAttempts,
        expiresAtMs: attempt.expiresAt,
      };
    }

    return {
      attempt,
      orderedParts,
      partAttempts,
      resumePartKey: resolveResumePartKey({
        completedPartIndices: attempt.completedPartIndices,
        orderedParts,
        partAttempts,
      }),
      expiresAtMs: attempt.expiresAt,
    };
  },
});
