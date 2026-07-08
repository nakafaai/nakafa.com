import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  expireAttemptAtEffectiveTime,
  finalizeSectionAttempt,
  getAttemptExpiresAt,
} from "@repo/backend/convex/tryouts/runtime/finish";
import {
  createSectionPlacements,
  requireSectionSnapshot,
  requireSnapshotSection,
} from "@repo/backend/convex/tryouts/runtime/placement";
import { ConvexError } from "convex/values";

type TryoutAttempt = Doc<"tryoutAttempts">;

/** Starts one section attempt and its timer inside an active try-out attempt. */
export async function startSectionAttempt(
  ctx: MutationCtx,
  args: { attempt: TryoutAttempt; now: number; sectionKey: string }
) {
  if (args.attempt.status !== "in-progress") {
    throw new ConvexError({
      code: "TRYOUT_ATTEMPT_NOT_ACTIVE",
      message: "Try-out attempt is not active.",
    });
  }

  if (args.now >= getAttemptExpiresAt(args.attempt)) {
    await expireAttemptAtEffectiveTime(ctx, {
      attempt: args.attempt,
      now: args.now,
    });
    throw new ConvexError({
      code: "TRYOUT_ATTEMPT_NOT_ACTIVE",
      message: "Try-out attempt time has expired.",
    });
  }

  const existing = await loadSectionAttempt(ctx, args);

  if (existing?.status === "in-progress" && args.now < existing.expiresAt) {
    return { kind: "started" as const };
  }

  if (existing?.status === "in-progress") {
    await finalizeSectionAttempt(ctx, {
      attempt: args.attempt,
      endReason: "time-expired",
      now: args.now,
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

  const currentAttempt = await requireNoParallelSectionTimer(ctx, args);
  const snapshot = requireSectionSnapshot(currentAttempt, args.sectionKey);
  const section = await requireSnapshotSection(ctx, {
    attempt: currentAttempt,
    snapshot,
  });
  const expiresAt = Math.min(
    args.now + section.timeLimitSeconds * 1000,
    getAttemptExpiresAt(currentAttempt)
  );
  const sectionAttemptId = await ctx.db.insert("tryoutSectionAttempts", {
    answeredCount: 0,
    completedAt: null,
    correctAnswers: 0,
    endReason: null,
    expiresAt,
    lastActivityAt: args.now,
    sectionKey: section.sectionKey,
    sectionOrder: section.order,
    startedAt: args.now,
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
    section,
    sectionAttempt,
  });
  await ctx.db.patch(currentAttempt._id, {
    lastActivityAt: args.now,
  });
  await ctx.scheduler.runAfter(
    Math.max(0, expiresAt - args.now),
    internal.tryouts.mutations.expiry.section,
    { expiresAt, sectionAttemptId }
  );

  return { kind: "started" as const };
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
