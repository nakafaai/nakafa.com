import { query } from "@repo/backend/convex/_generated/server";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { vv } from "@repo/backend/convex/lib/validators";
import { v } from "convex/values";
import { getManyFrom } from "convex-helpers/server/relationships";
import { nullable } from "convex-helpers/validators";

const attemptWithAnswersValidator = v.object({
  attempt: vv.doc("exerciseAttempts"),
  answers: v.array(vv.doc("exerciseAnswers")),
});

/**
 * Get the latest attempt for a specific exercise/set.
 *
 * Best Practices:
 * - Uses `.withIndex` for O(log n) efficient lookup (no table scans).
 * - Returns the most recent attempt regardless of status (in-progress, completed, expired, abandoned).
 * - Joins answers efficiently using `.withIndex` on the child table.
 */
export const getLatestAttemptBySlug = query({
  args: {
    slug: v.string(),
  },
  returns: nullable(attemptWithAnswersValidator),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);
    const userId = appUser._id;

    const attempt = await ctx.db
      .query("exerciseAttempts")
      .withIndex("userId_slug_scope_startedAt", (q) =>
        q.eq("userId", userId).eq("slug", args.slug).eq("scope", "set")
      )
      .order("desc")
      .first();

    if (!attempt) {
      return null;
    }

    const answers = await getManyFrom(
      ctx.db,
      "exerciseAnswers",
      "attemptId_exerciseNumber",
      attempt._id,
      "attemptId"
    );

    // 3. Return the combined state (Attempt + Answers).
    return {
      attempt,
      answers,
    };
  },
});
