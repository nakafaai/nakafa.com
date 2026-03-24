import { query } from "@repo/backend/convex/_generated/server";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { v } from "convex/values";
import { getManyFrom } from "convex-helpers/server/relationships";
import { nullable } from "convex-helpers/validators";

const attemptWithAnswersValidator = v.object({
  attempt: vv.doc("exerciseAttempts"),
  answers: v.array(vv.doc("exerciseAnswers")),
});

const questionAnswerSheetValidator = v.array(
  v.object({
    exerciseNumber: v.number(),
    questionId: vv.id("exerciseQuestions"),
    options: v.array(
      v.object({
        optionKey: v.string(),
        order: v.number(),
      })
    ),
  })
);

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
  args: {
    locale: localeValidator,
    slug: v.string(),
  },
  returns: questionAnswerSheetValidator,
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const set = await ctx.db
      .query("exerciseSets")
      .withIndex("by_locale_and_slug", (q) =>
        q.eq("locale", args.locale).eq("slug", args.slug)
      )
      .first();

    if (!set) {
      return [];
    }

    const questions = await getManyFrom(
      ctx.db,
      "exerciseQuestions",
      "by_setId",
      set._id
    );
    const orderedQuestions = [...questions].sort((a, b) => a.number - b.number);

    const answerSheet = await Promise.all(
      orderedQuestions.map(async (question) => {
        const choices = await getManyFrom(
          ctx.db,
          "exerciseChoices",
          "by_questionId_and_locale",
          question._id,
          "questionId"
        );

        return {
          exerciseNumber: question.number,
          questionId: question._id,
          options: choices
            .map((choice) => ({
              optionKey: choice.optionKey,
              order: choice.order,
            }))
            .sort((a, b) => a.order - b.order),
        };
      })
    );

    return answerSheet;
  },
});
