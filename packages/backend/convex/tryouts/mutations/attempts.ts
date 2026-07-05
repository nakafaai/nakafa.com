import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { mutation } from "@repo/backend/convex/functions";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { tryoutRouteKeyValidator } from "@repo/backend/convex/tryouts/schema";
import { ConvexError, v } from "convex/values";

const ATTEMPT_DURATION_MS = 2 * 60 * 60 * 1000;
const MAX_ATTEMPTS_PER_USER_SET = 100;
const CHOICE_LIMIT_PER_QUESTION = 10;

type TryoutSet = Doc<"tryoutSets">;
type TryoutSection = Doc<"tryoutSections">;

/** Loads one active set by the public try-out identity. */
async function loadActiveSet(
  ctx: MutationCtx,
  args: {
    countryKey: string;
    examKey: string;
    locale: "id" | "en";
    setKey: string;
  }
) {
  const set = await ctx.db
    .query("tryoutSets")
    .withIndex("by_countryKey_and_examKey_and_setKey_and_locale", (q) =>
      q
        .eq("countryKey", args.countryKey)
        .eq("examKey", args.examKey)
        .eq("setKey", args.setKey)
        .eq("locale", args.locale)
    )
    .unique();

  if (!set?.isActive) {
    throw new ConvexError({
      code: "TRYOUT_SET_NOT_FOUND",
      message: "Try-out set not found.",
    });
  }

  return set;
}

/** Loads and validates ordered section rows for one set snapshot. */
async function loadSections(ctx: MutationCtx, set: TryoutSet) {
  const sections = await ctx.db
    .query("tryoutSections")
    .withIndex("by_tryoutSetId_and_order", (q) => q.eq("tryoutSetId", set._id))
    .take(set.sectionCount + 1);

  if (sections.length !== set.sectionCount) {
    throw new ConvexError({
      code: "TRYOUT_SECTION_COUNT_MISMATCH",
      message: "Try-out set section count is not synced.",
    });
  }

  return sections;
}

/** Loads and validates ordered question rows for one section. */
async function loadQuestions(ctx: MutationCtx, section: TryoutSection) {
  const questions = await ctx.db
    .query("questions")
    .withIndex("by_questionSetId_and_number", (q) =>
      q.eq("questionSetId", section.questionSetId)
    )
    .take(section.questionCount + 1);

  if (questions.length !== section.questionCount) {
    throw new ConvexError({
      code: "TRYOUT_QUESTION_COUNT_MISMATCH",
      message: "Try-out section question count is not synced.",
    });
  }

  return questions;
}

/** Returns the next bounded attempt number for one user and set. */
async function getNextAttemptNumber(
  ctx: MutationCtx,
  args: { tryoutSetId: Id<"tryoutSets">; userId: Id<"users"> }
) {
  const attempts = await ctx.db
    .query("tryoutAttempts")
    .withIndex("by_userId_and_tryoutSetId_and_startedAt", (q) =>
      q.eq("userId", args.userId).eq("tryoutSetId", args.tryoutSetId)
    )
    .take(MAX_ATTEMPTS_PER_USER_SET);

  if (attempts.length >= MAX_ATTEMPTS_PER_USER_SET) {
    throw new ConvexError({
      code: "TRYOUT_ATTEMPT_LIMIT_REACHED",
      message: "Try-out attempt limit reached for this set.",
    });
  }

  return attempts.length + 1;
}

/** Starts one bounded try-out attempt from synced section and question rows. */
export const startAttempt = mutation({
  args: {
    countryKey: tryoutRouteKeyValidator,
    examKey: tryoutRouteKeyValidator,
    locale: localeValidator,
    setKey: tryoutRouteKeyValidator,
  },
  returns: v.object({
    attemptId: v.id("tryoutAttempts"),
  }),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);
    const set = await loadActiveSet(ctx, args);
    const sections = await loadSections(ctx, set);
    const attemptNumber = await getNextAttemptNumber(ctx, {
      tryoutSetId: set._id,
      userId: appUser._id,
    });
    const now = Date.now();
    const expiresAt = now + ATTEMPT_DURATION_MS;

    const attemptId = await ctx.db.insert("tryoutAttempts", {
      attemptNumber,
      completedAt: null,
      completedSectionKeys: [],
      endReason: null,
      expiresAt,
      lastActivityAt: now,
      scoreStatus: "provisional",
      sectionSnapshots: sections.map((section) => ({
        questionCount: section.questionCount,
        sectionKey: section.sectionKey,
        sectionOrder: section.order,
        tryoutSectionId: section._id,
      })),
      startedAt: now,
      status: "in-progress",
      totalCorrect: 0,
      totalQuestions: set.totalQuestionCount,
      tryoutSetId: set._id,
      userId: appUser._id,
    });

    let questionOrder = 1;

    for (const section of sections) {
      const sectionAttemptId = await ctx.db.insert("tryoutSectionAttempts", {
        answeredCount: 0,
        completedAt: null,
        correctAnswers: 0,
        endReason: null,
        expiresAt,
        lastActivityAt: now,
        sectionKey: section.sectionKey,
        sectionOrder: section.order,
        startedAt: now,
        status: "in-progress",
        totalQuestions: section.questionCount,
        tryoutAttemptId: attemptId,
        tryoutSectionId: section._id,
      });
      const questions = await loadQuestions(ctx, section);

      for (const question of questions) {
        await ctx.db.insert("tryoutAttemptPlacements", {
          contentHash: question.contentHash,
          questionId: question._id,
          questionOrder,
          questionSourceKey: question.sourceKey,
          sourceRevision: question.sourceRevision,
          tryoutAttemptId: attemptId,
          tryoutSectionAttemptId: sectionAttemptId,
          tryoutSectionId: section._id,
        });
        questionOrder++;
      }
    }

    return { attemptId };
  },
});

/** Saves one selected multiple-choice answer for a try-out placement. */
export const saveResponse = mutation({
  args: {
    placementId: v.id("tryoutAttemptPlacements"),
    selectedOptionId: v.optional(v.string()),
    timeSpent: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const placement = await ctx.db.get(args.placementId);

    if (!placement) {
      throw new ConvexError({
        code: "TRYOUT_PLACEMENT_NOT_FOUND",
        message: "Try-out question placement not found.",
      });
    }

    const attempt = await ctx.db.get(placement.tryoutAttemptId);

    if (attempt?.status !== "in-progress") {
      throw new ConvexError({
        code: "TRYOUT_ATTEMPT_NOT_ACTIVE",
        message: "Try-out attempt is not active.",
      });
    }

    const question = await ctx.db.get(placement.questionId);

    if (!question) {
      throw new ConvexError({
        code: "TRYOUT_QUESTION_NOT_FOUND",
        message: "Try-out question not found.",
      });
    }

    const choices = await ctx.db
      .query("questionChoices")
      .withIndex("by_questionId_and_locale", (q) =>
        q.eq("questionId", question._id).eq("locale", question.locale)
      )
      .take(CHOICE_LIMIT_PER_QUESTION);
    const selectedChoice = choices.find(
      (choice) => choice.optionKey === args.selectedOptionId
    );
    const isCorrect = selectedChoice?.isCorrect ?? false;
    const existing = await ctx.db
      .query("tryoutResponses")
      .withIndex("by_placementId", (q) => q.eq("placementId", placement._id))
      .unique();
    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        answeredAt: existing.answeredAt,
        isCorrect,
        selectedOptionId: args.selectedOptionId,
        timeSpent: args.timeSpent,
        updatedAt: now,
      });
      return null;
    }

    await ctx.db.insert("tryoutResponses", {
      answeredAt: now,
      isCorrect,
      placementId: placement._id,
      questionId: placement.questionId,
      selectedOptionId: args.selectedOptionId,
      timeSpent: args.timeSpent,
      tryoutAttemptId: placement.tryoutAttemptId,
      tryoutSectionAttemptId: placement.tryoutSectionAttemptId,
      updatedAt: now,
    });

    return null;
  },
});

/** Finalizes one attempt idempotently and stores the score snapshot. */
export const finalizeAttempt = mutation({
  args: {
    attemptId: v.id("tryoutAttempts"),
  },
  returns: v.object({
    scoreId: v.id("tryoutScores"),
  }),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);
    const attempt = await ctx.db.get(args.attemptId);

    if (!attempt || attempt.userId !== appUser._id) {
      throw new ConvexError({
        code: "TRYOUT_ATTEMPT_NOT_FOUND",
        message: "Try-out attempt not found.",
      });
    }

    const existingScore = await ctx.db
      .query("tryoutScores")
      .withIndex("by_tryoutAttemptId", (q) =>
        q.eq("tryoutAttemptId", attempt._id)
      )
      .unique();

    if (existingScore) {
      return { scoreId: existingScore._id };
    }

    const set = await ctx.db.get(attempt.tryoutSetId);

    if (!set) {
      throw new ConvexError({
        code: "TRYOUT_SET_NOT_FOUND",
        message: "Try-out set not found.",
      });
    }

    const responses = await ctx.db
      .query("tryoutResponses")
      .withIndex("by_tryoutAttemptId_and_questionId", (q) =>
        q.eq("tryoutAttemptId", attempt._id)
      )
      .take(attempt.totalQuestions + 1);

    if (responses.length > attempt.totalQuestions) {
      throw new ConvexError({
        code: "TRYOUT_RESPONSE_COUNT_EXCEEDED",
        message: "Try-out response count exceeds the attempt question count.",
      });
    }

    const totalCorrect = responses.filter(
      (response) => response.isCorrect
    ).length;
    const publishedScore =
      attempt.totalQuestions > 0
        ? Math.round((totalCorrect / attempt.totalQuestions) * 100)
        : 0;
    const now = Date.now();
    const scoreId = await ctx.db.insert("tryoutScores", {
      finalizedAt: now,
      publishedScore,
      rawScore: publishedScore,
      scoreStatus: set.scoringStrategy === "irt" ? "provisional" : "official",
      scoringStrategy: set.scoringStrategy,
      totalCorrect,
      totalQuestions: attempt.totalQuestions,
      tryoutAttemptId: attempt._id,
      tryoutSetId: attempt.tryoutSetId,
      userId: appUser._id,
    });

    await ctx.db.patch(attempt._id, {
      completedAt: now,
      endReason: "submitted",
      lastActivityAt: now,
      scoreStatus: set.scoringStrategy === "irt" ? "provisional" : "official",
      status: "completed",
      totalCorrect,
    });

    return { scoreId };
  },
});
