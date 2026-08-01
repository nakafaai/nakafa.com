import { mutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { requireActiveReadyTryoutSet } from "@repo/backend/convex/tryouts/read";
import {
  expireAttemptAtEffectiveTime,
  finalizeSectionAttempt,
  getAttemptExpiresAt,
} from "@repo/backend/convex/tryouts/runtime/finish";
import { requireOwnedAttempt } from "@repo/backend/convex/tryouts/runtime/score";
import { loadPlacementSectionAttempt } from "@repo/backend/convex/tryouts/runtime/sectionAttempt";
import { startTryoutAttempt } from "@repo/backend/convex/tryouts/start/impl";
import {
  startAttemptArgsValidator,
  startAttemptResultValidator,
  toTryoutStartError,
} from "@repo/backend/convex/tryouts/start/spec";
import { ConvexError, v } from "convex/values";
import { Clock, Effect } from "effect";

/** Starts one bounded try-out attempt from synced section and question rows. */
export const startAttempt = mutation({
  args: startAttemptArgsValidator,
  returns: startAttemptResultValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      Effect.gen(function* () {
        const { appUser } = yield* Effect.tryPromise({
          catch: toTryoutStartError,
          try: () => requireAuth(ctx),
        });
        const set = yield* Effect.tryPromise({
          catch: toTryoutStartError,
          try: () => requireActiveReadyTryoutSet(ctx, args),
        });
        const now = yield* Clock.currentTimeMillis;

        return yield* startTryoutAttempt(ctx, {
          args,
          now,
          set,
          userId: appUser._id,
        });
      })
    ),
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

    const section = await loadPlacementSectionAttempt(ctx, placement);

    if (section?.status !== "in-progress") {
      throw new ConvexError({
        code: "TRYOUT_SECTION_NOT_ACTIVE",
        message: "Try-out section is not active.",
      });
    }

    const now = Date.now();

    if (now >= getAttemptExpiresAt(attempt)) {
      await expireAttemptAtEffectiveTime(ctx, { attempt, now });
      throw new ConvexError({
        code: "TRYOUT_EXPIRED",
        message: "Try-out attempt time has expired.",
      });
    }

    if (now >= section.expiresAt) {
      await finalizeSectionAttempt(ctx, {
        attempt,
        endReason: "time-expired",
        now,
        section,
      });
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
      tryoutSectionAttemptId: section._id,
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
