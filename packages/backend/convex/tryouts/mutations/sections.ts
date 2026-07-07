import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { mutation } from "@repo/backend/convex/functions";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { TRYOUT_CHOICE_LIMIT } from "@repo/backend/convex/tryouts/questions";
import {
  expireAttemptAtEffectiveTime,
  finalizeSectionAttempt,
  getAttemptExpiresAt,
} from "@repo/backend/convex/tryouts/runtime/finish";
import { requireOwnedAttempt } from "@repo/backend/convex/tryouts/runtime/score";
import { tryoutRouteKeyValidator } from "@repo/backend/convex/tryouts/schema";
import { ConvexError, v } from "convex/values";

const SECTION_COMPLETED_RESULT = "completed";
const SECTION_STARTED_RESULT = "started";

type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutQuestion = Doc<"questions">;
type TryoutSection = Doc<"tryoutSections">;
type TryoutSectionAttempt = Doc<"tryoutSectionAttempts">;
type TryoutEndReason = NonNullable<TryoutAttempt["endReason"]>;

/** Returns the stable mutation result for a completed section. */
function sectionCompletedResult(): { kind: "completed" } {
  return { kind: SECTION_COMPLETED_RESULT };
}

/** Returns the stable mutation result for a started section. */
function sectionStartedResult(): { kind: "started" } {
  return { kind: SECTION_STARTED_RESULT };
}

/** Returns the submitted or expired end reason for a section timer. */
function getSectionEndReason(
  section: TryoutSectionAttempt,
  now: number
): TryoutEndReason {
  if (now >= section.expiresAt) {
    return "time-expired";
  }

  return "submitted";
}

/** Loads the immutable section snapshot for one attempt section key. */
function requireSectionSnapshot(
  attempt: TryoutAttempt,
  sectionKey: string
): TryoutAttempt["sectionSnapshots"][number] {
  const snapshot = attempt.sectionSnapshots.find(
    (section) => section.sectionKey === sectionKey
  );

  if (!snapshot) {
    throw new ConvexError({
      code: "TRYOUT_SECTION_NOT_FOUND",
      message: "Try-out section is not part of this attempt.",
    });
  }

  return snapshot;
}

/** Loads the live section row backing an attempt snapshot. */
async function requireSnapshotSection(
  ctx: MutationCtx,
  args: {
    attempt: TryoutAttempt;
    snapshot: TryoutAttempt["sectionSnapshots"][number];
  }
): Promise<TryoutSection> {
  const section = await ctx.db.get(args.snapshot.tryoutSectionId);

  if (
    !section ||
    section.tryoutSetId !== args.attempt.tryoutSetId ||
    section.sectionKey !== args.snapshot.sectionKey ||
    section.questionSetId !== args.snapshot.questionSetId ||
    section.questionSourcePath !== args.snapshot.questionSourcePath ||
    section.questionCount !== args.snapshot.questionCount ||
    section.sourceRevision !== args.snapshot.sourceRevision
  ) {
    throw new ConvexError({
      code: "TRYOUT_SECTION_NOT_FOUND",
      message: "Try-out section not found.",
    });
  }

  return section;
}

/** Loads one active section attempt by its stable section key. */
async function requireActiveSectionAttempt(
  ctx: MutationCtx,
  args: { attempt: TryoutAttempt; sectionKey: string }
) {
  const section = await ctx.db
    .query("tryoutSectionAttempts")
    .withIndex("by_tryoutAttemptId_and_sectionKey", (q) =>
      q
        .eq("tryoutAttemptId", args.attempt._id)
        .eq("sectionKey", args.sectionKey)
    )
    .unique();

  if (section?.status !== "in-progress") {
    throw new ConvexError({
      code: "TRYOUT_SECTION_NOT_ACTIVE",
      message: "Try-out section is not active.",
    });
  }

  return section;
}

/** Loads one existing section attempt by its stable section key. */
function loadSectionAttempt(
  ctx: MutationCtx,
  args: { attempt: TryoutAttempt; sectionKey: string }
) {
  return ctx.db
    .query("tryoutSectionAttempts")
    .withIndex("by_tryoutAttemptId_and_sectionKey", (q) =>
      q
        .eq("tryoutAttemptId", args.attempt._id)
        .eq("sectionKey", args.sectionKey)
    )
    .unique();
}

/** Loads all section attempts for one attempt snapshot. */
async function loadSectionAttempts(ctx: MutationCtx, attempt: TryoutAttempt) {
  const sections = await ctx.db
    .query("tryoutSectionAttempts")
    .withIndex("by_tryoutAttemptId_and_sectionOrder", (q) =>
      q.eq("tryoutAttemptId", attempt._id)
    )
    .take(attempt.sectionSnapshots.length + 1);

  if (sections.length > attempt.sectionSnapshots.length) {
    throw new ConvexError({
      code: "TRYOUT_SECTION_ATTEMPT_COUNT_EXCEEDED",
      message: "Try-out section attempt count exceeds the attempt snapshot.",
    });
  }

  return sections;
}

/** Rejects or expires any other in-progress section timer. */
async function requireNoParallelSectionTimer(
  ctx: MutationCtx,
  args: { attempt: TryoutAttempt; now: number; sectionKey: string }
) {
  const sections = await loadSectionAttempts(ctx, args.attempt);

  for (const section of sections) {
    if (section.sectionKey === args.sectionKey) {
      continue;
    }

    if (section.status !== "in-progress") {
      continue;
    }

    if (args.now >= section.expiresAt) {
      await finalizeSectionAttempt(ctx, {
        attempt: args.attempt,
        endReason: "time-expired",
        now: args.now,
        section,
      });
      continue;
    }

    throw new ConvexError({
      code: "TRYOUT_SECTION_IN_PROGRESS",
      message: "Another try-out section is already in progress.",
    });
  }

  const currentAttempt = await ctx.db.get(args.attempt._id);

  if (currentAttempt?.status !== "in-progress") {
    throw new ConvexError({
      code: "TRYOUT_ATTEMPT_NOT_ACTIVE",
      message: "Try-out attempt is not active.",
    });
  }

  return currentAttempt;
}

/** Loads the ordered question rows for one section. */
async function loadSectionQuestions(ctx: MutationCtx, section: TryoutSection) {
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

/** Loads the ordered choice snapshot for one runtime placement. */
async function loadChoiceSnapshots(ctx: MutationCtx, question: TryoutQuestion) {
  const choices = await ctx.db
    .query("questionChoices")
    .withIndex("by_questionId_and_locale", (q) =>
      q.eq("questionId", question._id).eq("locale", question.locale)
    )
    .take(TRYOUT_CHOICE_LIMIT + 1);

  if (choices.length > TRYOUT_CHOICE_LIMIT) {
    throw new ConvexError({
      code: "TRYOUT_CHOICE_COUNT_EXCEEDED",
      message: "Try-out question choice count exceeds the sync limit.",
    });
  }

  if (choices.length === 0) {
    throw new ConvexError({
      code: "TRYOUT_CHOICE_COUNT_MISMATCH",
      message: "Try-out question has no synced choices.",
    });
  }

  return choices
    .map((choice) => ({
      isCorrect: choice.isCorrect,
      label: choice.label,
      optionKey: choice.optionKey,
      order: choice.order,
    }))
    .sort((left, right) => left.order - right.order);
}

/** Creates the runtime question placements for a just-started section. */
async function createSectionPlacements(
  ctx: MutationCtx,
  args: {
    attempt: TryoutAttempt;
    questions: TryoutQuestion[];
    section: TryoutSection;
    sectionAttempt: TryoutSectionAttempt;
  }
) {
  const snapshots = await Promise.all(
    args.questions.map(async (question) => ({
      choiceSnapshots: await loadChoiceSnapshots(ctx, question),
      question,
    }))
  );

  for (const snapshot of snapshots) {
    const { choiceSnapshots, question } = snapshot;
    await ctx.db.insert("tryoutAttemptPlacements", {
      choiceSnapshots,
      contentHash: question.contentHash,
      questionId: question._id,
      questionOrder: question.number,
      questionSourceKey: question.sourceKey,
      sourcePath: question.sourcePath,
      sourceRevision: question.sourceRevision,
      title: question.title,
      tryoutAttemptId: args.attempt._id,
      tryoutSectionAttemptId: args.sectionAttempt._id,
      tryoutSectionId: args.section._id,
    });
  }
}

/** Starts one section attempt and its timer inside an active try-out attempt. */
export const start = mutation({
  args: {
    attemptId: v.id("tryoutAttempts"),
    sectionKey: tryoutRouteKeyValidator,
  },
  returns: v.object({
    kind: v.literal(SECTION_STARTED_RESULT),
  }),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);
    const attempt = await requireOwnedAttempt(ctx, {
      attemptId: args.attemptId,
      userId: appUser._id,
    });
    const now = Date.now();

    if (attempt.status !== "in-progress") {
      throw new ConvexError({
        code: "TRYOUT_ATTEMPT_NOT_ACTIVE",
        message: "Try-out attempt is not active.",
      });
    }

    if (now >= getAttemptExpiresAt(attempt)) {
      await expireAttemptAtEffectiveTime(ctx, { attempt, now });
      throw new ConvexError({
        code: "TRYOUT_ATTEMPT_NOT_ACTIVE",
        message: "Try-out attempt time has expired.",
      });
    }

    const existing = await loadSectionAttempt(ctx, {
      attempt,
      sectionKey: args.sectionKey,
    });

    if (existing?.status === "in-progress" && now < existing.expiresAt) {
      return sectionStartedResult();
    }

    if (existing?.status === "in-progress") {
      await finalizeSectionAttempt(ctx, {
        attempt,
        endReason: "time-expired",
        now,
        section: existing,
      });
      throw new ConvexError({
        code: "TRYOUT_SECTION_NOT_ACTIVE",
        message: "Try-out section time has expired.",
      });
    }

    if (existing) {
      throw new ConvexError({
        code: "TRYOUT_SECTION_ALREADY_FINISHED",
        message: "Try-out section already finished.",
      });
    }

    const currentAttempt = await requireNoParallelSectionTimer(ctx, {
      attempt,
      now,
      sectionKey: args.sectionKey,
    });
    const snapshot = requireSectionSnapshot(currentAttempt, args.sectionKey);
    const section = await requireSnapshotSection(ctx, {
      attempt: currentAttempt,
      snapshot,
    });
    const questions = await loadSectionQuestions(ctx, section);
    const expiresAt = Math.min(
      now + section.timeLimitSeconds * 1000,
      getAttemptExpiresAt(currentAttempt)
    );
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
      tryoutAttemptId: currentAttempt._id,
      tryoutSectionId: section._id,
    });
    const sectionAttempt = await ctx.db.get(sectionAttemptId);

    if (!sectionAttempt) {
      throw new ConvexError({
        code: "TRYOUT_SECTION_NOT_FOUND",
        message: "Try-out section attempt not found.",
      });
    }

    await createSectionPlacements(ctx, {
      attempt: currentAttempt,
      questions,
      section,
      sectionAttempt,
    });
    await ctx.db.patch(currentAttempt._id, {
      lastActivityAt: now,
    });
    await ctx.scheduler.runAfter(
      Math.max(0, expiresAt - now),
      internal.tryouts.mutations.expiry.section,
      { expiresAt, sectionAttemptId }
    );

    return sectionStartedResult();
  },
});

/** Completes one section and finalizes the attempt when no sections remain. */
export const complete = mutation({
  args: {
    attemptId: v.id("tryoutAttempts"),
    sectionKey: tryoutRouteKeyValidator,
  },
  returns: v.object({
    kind: v.literal(SECTION_COMPLETED_RESULT),
  }),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuth(ctx);
    const attempt = await requireOwnedAttempt(ctx, {
      attemptId: args.attemptId,
      userId: appUser._id,
    });

    if (attempt.status !== "in-progress") {
      throw new ConvexError({
        code: "TRYOUT_ATTEMPT_NOT_ACTIVE",
        message: "Try-out attempt is not active.",
      });
    }

    const now = Date.now();

    if (now >= getAttemptExpiresAt(attempt)) {
      await expireAttemptAtEffectiveTime(ctx, { attempt, now });
      throw new ConvexError({
        code: "TRYOUT_ATTEMPT_NOT_ACTIVE",
        message: "Try-out attempt time has expired.",
      });
    }

    const section = await requireActiveSectionAttempt(ctx, {
      attempt,
      sectionKey: args.sectionKey,
    });
    const endReason = getSectionEndReason(section, now);

    await finalizeSectionAttempt(ctx, {
      attempt,
      endReason,
      now,
      section,
    });

    return sectionCompletedResult();
  },
});
