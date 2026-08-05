import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { type QueryCtx, query } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { getOptionalAppUserForRead } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { getSectionScoreResult } from "@repo/backend/convex/tryouts/queries/score";
import { tryoutRouteKeyValidator } from "@repo/backend/convex/tryouts/route";
import {
  getTryoutSectionContentAccess,
  tryoutCurrentSectionValidator,
} from "@repo/backend/convex/tryouts/runtime/content";
import { readRouteAttempt } from "@repo/backend/convex/tryouts/runtime/lookup";
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
    .withIndex("by_tryoutSectionAttemptId_and_answeredAt", (q) =>
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

/** Loads placements through the immutable signed section key. */
async function loadRuntimePlacements(
  ctx: QueryCtx,
  attempt: Doc<"tryoutAttempts">,
  section: Doc<"tryoutSectionAttempts">
) {
  return await ctx.db
    .query("tryoutAttemptPlacements")
    .withIndex("by_tryoutAttemptId_and_sectionKey_and_questionOrder", (index) =>
      index
        .eq("tryoutAttemptId", attempt._id)
        .eq("sectionKey", section.sectionKey)
    )
    .take(section.totalQuestions + 1);
}

/** Reads the current user's section runtime with placements and answers. */
export const getSection = query({
  args: {
    attemptId: v.optional(v.id("tryoutAttempts")),
    countryKey: tryoutRouteKeyValidator,
    examKey: tryoutRouteKeyValidator,
    locale: localeValidator,
    sectionKey: tryoutRouteKeyValidator,
    setKey: tryoutRouteKeyValidator,
    trackKey: tryoutRouteKeyValidator,
  },
  returns: v.union(v.null(), sectionRuntimeValidator),
  handler: async (ctx, args) => {
    const auth = await getOptionalAppUserForRead(ctx);

    if (!auth) {
      return null;
    }

    const attempt = await runConvexProgram(
      readRouteAttempt(ctx, args, auth.appUser._id)
    );

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

    const placements = await loadRuntimePlacements(ctx, attempt, section);

    if (placements.length !== section.totalQuestions) {
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
