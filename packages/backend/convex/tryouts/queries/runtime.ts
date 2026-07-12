import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { type QueryCtx, query } from "@repo/backend/convex/_generated/server";
import { getOptionalAppUser } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { getSectionScoreResult } from "@repo/backend/convex/tryouts/queries/score";
import { getActiveTryoutSet } from "@repo/backend/convex/tryouts/read";
import {
  getTryoutSectionContentAccess,
  tryoutCurrentSectionValidator,
} from "@repo/backend/convex/tryouts/runtime/content";
import { tryoutRouteKeyValidator } from "@repo/backend/convex/tryouts/schema";
import { ConvexError, v } from "convex/values";

const runtimeChoiceValidator = v.object({
  isCorrect: v.optional(v.boolean()),
  label: v.string(),
  optionKey: v.string(),
  order: v.number(),
});

const runtimeResponseValidator = v.object({
  answeredAt: v.number(),
  selectedOptionId: v.optional(v.string()),
  updatedAt: v.number(),
});

const runtimeQuestionValidator = v.object({
  choices: v.array(runtimeChoiceValidator),
  contentHash: v.string(),
  placementId: v.id("tryoutAttemptPlacements"),
  questionId: v.id("questions"),
  questionOrder: v.number(),
  response: v.union(runtimeResponseValidator, v.null()),
  sourcePath: v.string(),
  sourceRevision: v.string(),
  title: v.string(),
});

const sectionRuntimeValidator = v.object({
  attemptId: v.id("tryoutAttempts"),
  expiresAt: v.number(),
  questions: v.array(runtimeQuestionValidator),
  section: tryoutCurrentSectionValidator,
});

/** Loads bounded runtime responses for one section attempt. */
async function loadRuntimeResponses(
  ctx: QueryCtx,
  section: Doc<"tryoutSectionAttempts">
) {
  const responses = await ctx.db
    .query("tryoutResponses")
    .withIndex("by_tryoutSectionAttemptId_and_questionId", (q) =>
      q.eq("tryoutSectionAttemptId", section._id)
    )
    .take(section.totalQuestions + 1);

  if (responses.length > section.totalQuestions) {
    throw new ConvexError({
      code: "TRYOUT_RESPONSE_COUNT_EXCEEDED",
      message: "Try-out response count exceeds the section question count.",
    });
  }

  return new Map(responses.map((response) => [response.placementId, response]));
}

/** Reads the current user's section runtime with placements and answers. */
export const getSection = query({
  args: {
    countryKey: tryoutRouteKeyValidator,
    examKey: tryoutRouteKeyValidator,
    locale: localeValidator,
    sectionKey: tryoutRouteKeyValidator,
    setKey: tryoutRouteKeyValidator,
    trackKey: tryoutRouteKeyValidator,
  },
  returns: v.union(v.null(), sectionRuntimeValidator),
  handler: async (ctx, args) => {
    const auth = await getOptionalAppUser(ctx);

    if (!auth) {
      return null;
    }

    const set = await getActiveTryoutSet(ctx, args);

    if (!set) {
      return null;
    }

    const attempt = await ctx.db
      .query("tryoutAttempts")
      .withIndex("by_userId_and_tryoutSetId_and_startedAt", (q) =>
        q.eq("userId", auth.appUser._id).eq("tryoutSetId", set._id)
      )
      .order("desc")
      .first();

    if (!attempt) {
      return null;
    }

    const section = await ctx.db
      .query("tryoutSectionAttempts")
      .withIndex("by_tryoutAttemptId_and_sectionKey", (q) =>
        q.eq("tryoutAttemptId", attempt._id).eq("sectionKey", args.sectionKey)
      )
      .unique();

    if (!section) {
      return null;
    }

    const contentAccess = getTryoutSectionContentAccess(
      attempt.status,
      section.status
    );

    if (!contentAccess.questions) {
      return null;
    }

    const placements = await ctx.db
      .query("tryoutAttemptPlacements")
      .withIndex(
        "by_tryoutAttemptId_and_tryoutSectionId_and_questionOrder",
        (q) =>
          q
            .eq("tryoutAttemptId", attempt._id)
            .eq("tryoutSectionId", section.tryoutSectionId)
      )
      .take(section.totalQuestions + 1);

    if (placements.length > section.totalQuestions) {
      throw new ConvexError({
        code: "TRYOUT_PLACEMENT_COUNT_EXCEEDED",
        message: "Try-out section has more placements than its snapshot count.",
      });
    }

    const responses = await loadRuntimeResponses(ctx, section);
    const questions = placements.map((placement) => {
      const response = responses.get(placement._id) ?? null;
      const choices = [...placement.choiceSnapshots].sort(
        (left, right) => left.order - right.order
      );

      return {
        choices: choices.map((choice) => ({
          ...(contentAccess.answers ? { isCorrect: choice.isCorrect } : {}),
          label: choice.label,
          optionKey: choice.optionKey,
          order: choice.order,
        })),
        contentHash: placement.contentHash,
        placementId: placement._id,
        questionId: placement.questionId,
        questionOrder: placement.questionOrder,
        response: response
          ? {
              answeredAt: response.answeredAt,
              selectedOptionId: response.selectedOptionId,
              updatedAt: response.updatedAt,
            }
          : null,
        sourcePath: placement.sourcePath,
        sourceRevision: placement.sourceRevision,
        title: placement.title,
      };
    });

    return {
      attemptId: attempt._id,
      expiresAt: section.expiresAt,
      questions,
      section: {
        answeredCount: section.answeredCount,
        completedAt: section.completedAt,
        endReason: section.endReason,
        expiresAt: section.expiresAt,
        score: getSectionScoreResult(section),
        sectionKey: section.sectionKey,
        startedAt: section.startedAt,
        status: section.status,
        totalQuestions: section.totalQuestions,
      },
    };
  },
});
