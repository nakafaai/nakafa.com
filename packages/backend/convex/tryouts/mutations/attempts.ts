import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { captureProductEvent } from "@repo/backend/convex/analytics/capture";
import { mutation } from "@repo/backend/convex/functions";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { requireActiveTryoutSet } from "@repo/backend/convex/tryouts/read";
import {
  getAttemptAccessFields,
  requireActiveEntitlement,
} from "@repo/backend/convex/tryouts/runtime/access";
import { expireAttempt } from "@repo/backend/convex/tryouts/runtime/finish";
import {
  finalizeAttemptScore,
  requireOwnedAttempt,
} from "@repo/backend/convex/tryouts/runtime/score";
import { tryoutRouteKeyValidator } from "@repo/backend/convex/tryouts/schema";
import { ConvexError, v } from "convex/values";

const ATTEMPT_DURATION_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS_PER_USER_SET = 100;

type TryoutSet = Doc<"tryoutSets">;

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
    const set = await requireActiveTryoutSet(ctx, args);
    const now = Date.now();
    const [sections, attemptNumber, entitlement] = await Promise.all([
      loadSections(ctx, set),
      getNextAttemptNumber(ctx, {
        tryoutSetId: set._id,
        userId: appUser._id,
      }),
      requireActiveEntitlement(ctx, {
        countryKey: args.countryKey,
        examKey: args.examKey,
        now,
        setKey: args.setKey,
        userId: appUser._id,
      }),
    ]);
    const expiresAt = now + ATTEMPT_DURATION_MS;
    const access = getAttemptAccessFields(entitlement);

    const attemptId = await ctx.db.insert("tryoutAttempts", {
      attemptNumber,
      ...access,
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

    await ctx.scheduler.runAfter(
      Math.max(0, expiresAt - now),
      internal.tryouts.mutations.expiry.attempt,
      {
        attemptId,
        expiresAt,
      }
    );

    await captureProductEvent(ctx, {
      distinctId: appUser._id,
      event: {
        name: "tryout attempt started",
        properties: {
          attempt_number: attemptNumber,
          country_key: set.countryKey,
          exam_key: set.examKey,
          locale: set.locale,
          score_status: "provisional",
          set_key: set.setKey,
        },
      },
      timestamp: new Date(now),
    });

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
    const { appUser } = await requireAuth(ctx);
    const placement = await ctx.db.get(args.placementId);

    if (!placement) {
      throw new ConvexError({
        code: "TRYOUT_PLACEMENT_NOT_FOUND",
        message: "Try-out question placement not found.",
      });
    }

    const attempt = await requireOwnedAttempt(ctx, {
      attemptId: placement.tryoutAttemptId,
      userId: appUser._id,
    });

    if (attempt.status !== "in-progress") {
      throw new ConvexError({
        code: "TRYOUT_ATTEMPT_NOT_ACTIVE",
        message: "Try-out attempt is not active.",
      });
    }

    const section = await ctx.db.get(placement.tryoutSectionAttemptId);

    if (section?.status !== "in-progress") {
      throw new ConvexError({
        code: "TRYOUT_SECTION_NOT_ACTIVE",
        message: "Try-out section is not active.",
      });
    }

    const now = Date.now();

    if (now >= attempt.expiresAt) {
      await expireAttempt(ctx, { attempt, now });
      throw new ConvexError({
        code: "TRYOUT_EXPIRED",
        message: "Try-out attempt time has expired.",
      });
    }

    if (now >= section.expiresAt) {
      throw new ConvexError({
        code: "TRYOUT_EXPIRED",
        message: "Try-out attempt time has expired.",
      });
    }

    if (!args.selectedOptionId) {
      throw new ConvexError({
        code: "TRYOUT_CHOICE_REQUIRED",
        message: "Try-out selected choice is required.",
      });
    }

    const selectedChoice = placement.choiceSnapshots.find(
      (choice) => choice.optionKey === args.selectedOptionId
    );

    if (!selectedChoice) {
      throw new ConvexError({
        code: "TRYOUT_CHOICE_NOT_FOUND",
        message: "Try-out selected choice not found.",
      });
    }

    const isCorrect = selectedChoice.isCorrect;
    const existing = await ctx.db
      .query("tryoutResponses")
      .withIndex("by_placementId", (q) => q.eq("placementId", placement._id))
      .unique();

    if (existing) {
      const answeredDelta =
        existing.selectedOptionId === undefined &&
        existing.textAnswer === undefined
          ? 1
          : 0;
      const correctDelta = (isCorrect ? 1 : 0) - (existing.isCorrect ? 1 : 0);

      await ctx.db.patch(existing._id, {
        answeredAt: existing.answeredAt,
        isCorrect,
        selectedOptionId: args.selectedOptionId,
        timeSpent: args.timeSpent,
        updatedAt: now,
      });
      await ctx.db.patch(section._id, {
        answeredCount: section.answeredCount + answeredDelta,
        correctAnswers: section.correctAnswers + correctDelta,
        lastActivityAt: now,
      });
      await ctx.db.patch(attempt._id, {
        lastActivityAt: now,
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
    await ctx.db.patch(section._id, {
      answeredCount: section.answeredCount + 1,
      correctAnswers: section.correctAnswers + (isCorrect ? 1 : 0),
      lastActivityAt: now,
    });
    await ctx.db.patch(attempt._id, {
      lastActivityAt: now,
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
    const now = Date.now();
    const attempt = await requireOwnedAttempt(ctx, {
      attemptId: args.attemptId,
      userId: appUser._id,
    });

    if (attempt.status === "in-progress" && now >= attempt.expiresAt) {
      return expireAttempt(ctx, { attempt, now });
    }

    return finalizeAttemptScore(ctx, { attempt, now });
  },
});
