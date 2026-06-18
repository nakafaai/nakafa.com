import { query } from "@repo/backend/convex/_generated/server";
import {
  getQuestionAnswerSheetBySlugImpl,
  getRenderableRowsBySlugImpl,
} from "@repo/backend/convex/exercises/renderable/impl";
import {
  questionAnswerSheetReturnValidator,
  renderableRowsBySlugArgsValidator,
  renderableRowsBySlugReturnValidator,
} from "@repo/backend/convex/exercises/renderable/spec";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { vv } from "@repo/backend/convex/lib/validators/vv";
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
 * Returns the most recent attempt regardless of status.
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
      .withIndex("by_userId_and_origin_and_slug_and_scope_and_startedAt", (q) =>
        q
          .eq("userId", userId)
          .eq("origin", "standalone")
          .eq("slug", args.slug)
          .eq("scope", "set")
      )
      .order("desc")
      .first();

    if (!attempt) {
      return null;
    }

    const answers = await getManyFrom(
      ctx.db,
      "exerciseAnswers",
      "by_attemptId_and_exerciseNumber",
      attempt._id,
      "attemptId"
    );
    return {
      attempt,
      answers,
    };
  },
});

/**
 * Load the backend question IDs and canonical option keys for one exercise set.
 *
 * This gives the frontend the stable identifiers needed for
 * server-authoritative answer scoring without trusting client correctness flags.
 */
export const getQuestionAnswerSheetBySlug = query({
  args: renderableRowsBySlugArgsValidator,
  returns: questionAnswerSheetReturnValidator,
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    return await getQuestionAnswerSheetBySlugImpl(ctx, args);
  },
});

/**
 * Load renderable exercise rows from the synced Convex content read model.
 *
 * This query owns runtime try-out set membership. The page still imports exact
 * compiled MDX modules by number for the visible question and answer bodies.
 */
export const getRenderableRowsBySlug = query({
  args: renderableRowsBySlugArgsValidator,
  returns: renderableRowsBySlugReturnValidator,
  handler: getRenderableRowsBySlugImpl,
});
