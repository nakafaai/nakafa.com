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
import {
  expireAttemptAtEffectiveTime,
  finalizeSectionAttempt,
  getAttemptExpiresAt,
} from "@repo/backend/convex/tryouts/runtime/finish";
import { requireIrtScaleVersion } from "@repo/backend/convex/tryouts/runtime/irt";
import {
  finalizeAttemptScore,
  requireOwnedAttempt,
} from "@repo/backend/convex/tryouts/runtime/score";
import { startSectionAttempt } from "@repo/backend/convex/tryouts/runtime/sectionAttempt";
import { tryoutRouteKeyValidator } from "@repo/backend/convex/tryouts/schema";
import { ConvexError, v } from "convex/values";

const ATTEMPT_DURATION_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS_PER_USER_SET = 100;

type TryoutSet = Doc<"tryoutSets">;
type TryoutSection = Doc<"tryoutSections">;
type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutAttemptInsert = Omit<TryoutAttempt, "_creationTime" | "_id">;

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

  const totalQuestionCount = sections.reduce(
    (total, section) => total + section.questionCount,
    0
  );
  const hasMixedRevision = sections.some(
    (section) => section.sourceRevision !== set.sourceRevision
  );

  if (totalQuestionCount !== set.totalQuestionCount || hasMixedRevision) {
    throw new ConvexError({
      code: "TRYOUT_SECTION_SNAPSHOT_MISMATCH",
      message: "Try-out set sections are not fully synced.",
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

/** Loads the latest attempt for one user and set. */
async function loadLatestAttempt(
  ctx: MutationCtx,
  args: { tryoutSetId: Id<"tryoutSets">; userId: Id<"users"> }
) {
  const attempts = await ctx.db
    .query("tryoutAttempts")
    .withIndex("by_userId_and_tryoutSetId_and_startedAt", (q) =>
      q.eq("userId", args.userId).eq("tryoutSetId", args.tryoutSetId)
    )
    .order("desc")
    .take(1);

  return attempts.at(0) ?? null;
}

/** Ensures atomic section start is only used for a set-owned internal entry. */
function requireInternalEntrySection(
  sections: TryoutSection[],
  sectionKey: string
) {
  const section = sections.find((row) => row.sectionKey === sectionKey);

  if (section?.visibility !== "internal-entry") {
    throw new ConvexError({
      code: "TRYOUT_ENTRY_SECTION_NOT_FOUND",
      message: "Try-out entry section is not available for this set.",
    });
  }
}

/** Returns true when every snapshot is already completed or expired. */
function hasCompletedEverySection(attempt: TryoutAttempt) {
  const completedKeys = new Set(attempt.completedSectionKeys);

  return attempt.sectionSnapshots.every((section) =>
    completedKeys.has(section.sectionKey)
  );
}

/** Returns the entitlement-bounded attempt expiry for a new attempt. */
function getNewAttemptExpiresAt(
  now: number,
  entitlement: Doc<"tryoutEntitlements">
) {
  return Math.min(now + ATTEMPT_DURATION_MS, entitlement.endsAt);
}

/** Starts one bounded try-out attempt from synced section and question rows. */
export const startAttempt = mutation({
  args: {
    countryKey: tryoutRouteKeyValidator,
    examKey: tryoutRouteKeyValidator,
    entrySectionKey: v.optional(tryoutRouteKeyValidator),
    locale: localeValidator,
    setKey: tryoutRouteKeyValidator,
    trackKey: tryoutRouteKeyValidator,
  },
  returns: v.object({
    attemptId: v.id("tryoutAttempts"),
  }),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);
    const set = await requireActiveTryoutSet(ctx, args);

    if (!set.isReady) {
      throw new ConvexError({
        code: "TRYOUT_SET_NOT_READY",
        message: "Try-out set is not ready.",
      });
    }

    const now = Date.now();
    const [sections, entitlement, latestAttempt] = await Promise.all([
      loadSections(ctx, set),
      requireActiveEntitlement(ctx, {
        countryKey: args.countryKey,
        examKey: args.examKey,
        now,
        setKey: args.setKey,
        trackKey: args.trackKey,
        userId: appUser._id,
      }),
      loadLatestAttempt(ctx, {
        tryoutSetId: set._id,
        userId: appUser._id,
      }),
    ]);

    if (args.entrySectionKey) {
      requireInternalEntrySection(sections, args.entrySectionKey);
    }

    if (latestAttempt?.status === "in-progress") {
      if (now < getAttemptExpiresAt(latestAttempt)) {
        if (args.entrySectionKey) {
          await startSectionAttempt(ctx, {
            attempt: latestAttempt,
            now,
            sectionKey: args.entrySectionKey,
          });
        }

        return { attemptId: latestAttempt._id };
      }

      await expireAttemptAtEffectiveTime(ctx, {
        attempt: latestAttempt,
        now,
      });
    }

    const attemptNumber = await getNextAttemptNumber(ctx, {
      tryoutSetId: set._id,
      userId: appUser._id,
    });
    const scaleVersion = await loadAttemptScaleVersion(ctx, set);
    const expiresAt = getNewAttemptExpiresAt(now, entitlement);
    const access = getAttemptAccessFields(entitlement);
    const attemptStatus = "in-progress";
    const scoreStatus = "provisional";
    const attemptValues: TryoutAttemptInsert = {
      attemptNumber,
      ...access,
      completedAt: null,
      completedSectionKeys: [],
      endReason: null,
      expiresAt,
      lastActivityAt: now,
      scoreStatus,
      scoringStrategy: set.scoringStrategy,
      sectionSnapshots: sections.map((section) => ({
        publicPath: section.publicPath,
        questionCount: section.questionCount,
        questionSetId: section.questionSetId,
        questionSourcePath: section.questionSourcePath,
        sectionKey: section.sectionKey,
        sectionOrder: section.order,
        sourceRevision: section.sourceRevision,
        tryoutSectionId: section._id,
      })),
      startedAt: now,
      status: attemptStatus,
      totalCorrect: 0,
      totalQuestions: set.totalQuestionCount,
      tryoutSetId: set._id,
      userId: appUser._id,
    };
    if (scaleVersion) {
      attemptValues.scaleVersionId = scaleVersion._id;
    }

    const attemptId = await ctx.db.insert("tryoutAttempts", attemptValues);
    const attempt = await ctx.db.get(attemptId);

    if (!attempt) {
      throw new ConvexError({
        code: "TRYOUT_ATTEMPT_NOT_FOUND",
        message: "Try-out attempt not found.",
      });
    }

    if (args.entrySectionKey) {
      await startSectionAttempt(ctx, {
        attempt,
        now,
        sectionKey: args.entrySectionKey,
      });
    }

    await scheduleAttemptExpiry(ctx, { attemptId, expiresAt, now });
    await trackAttemptStarted(ctx, {
      appUserId: appUser._id,
      attemptNumber,
      now,
      set,
    });

    return { attemptId };
  },
});

/** Loads the score scale that must be snapshotted before starting an IRT set. */
async function loadAttemptScaleVersion(ctx: MutationCtx, set: TryoutSet) {
  if (set.scoringStrategy !== "irt") {
    return null;
  }

  return await requireIrtScaleVersion(ctx, { tryoutSetId: set._id });
}

/** Schedules the attempt expiry mutation for the exact stored attempt deadline. */
async function scheduleAttemptExpiry(
  ctx: MutationCtx,
  args: {
    attemptId: Id<"tryoutAttempts">;
    expiresAt: number;
    now: number;
  }
) {
  await ctx.scheduler.runAfter(
    Math.max(0, args.expiresAt - args.now),
    internal.tryouts.mutations.expiry.attempt,
    {
      attemptId: args.attemptId,
      expiresAt: args.expiresAt,
    }
  );
}

/** Records the existing analytics event for a newly-started try-out attempt. */
async function trackAttemptStarted(
  ctx: MutationCtx,
  args: {
    appUserId: Id<"users">;
    attemptNumber: number;
    now: number;
    set: TryoutSet;
  }
) {
  await captureProductEvent(ctx, {
    distinctId: args.appUserId,
    event: {
      name: "tryout attempt started",
      properties: {
        attempt_number: args.attemptNumber,
        country_key: args.set.countryKey,
        exam_key: args.set.examKey,
        locale: args.set.locale,
        score_status: "provisional",
        set_key: args.set.setKey,
        track_key: args.set.trackKey,
      },
    },
    timestamp: new Date(args.now),
  });
}

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

    if (
      attempt.status === "in-progress" &&
      now >= getAttemptExpiresAt(attempt)
    ) {
      return expireAttemptAtEffectiveTime(ctx, { attempt, now });
    }

    if (
      attempt.status === "in-progress" &&
      !hasCompletedEverySection(attempt)
    ) {
      throw new ConvexError({
        code: "TRYOUT_ATTEMPT_NOT_COMPLETE",
        message: "Try-out attempt still has unfinished sections.",
      });
    }

    return finalizeAttemptScore(ctx, { attempt, now });
  },
});
