import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  finalizeAttemptScore,
  summarizeResponses,
} from "@repo/backend/convex/tryouts/runtime/score";
import { ConvexError } from "convex/values";

type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutSectionAttempt = Doc<"tryoutSectionAttempts">;
type TryoutEndReason = NonNullable<TryoutAttempt["endReason"]>;
type TryoutSectionSnapshot = TryoutAttempt["sectionSnapshots"][number];

/** Returns the earliest timestamp that can end an attempt. */
export function getAttemptExpiresAt(attempt: TryoutAttempt) {
  return Math.min(attempt.expiresAt, attempt.accessEndsAt ?? attempt.expiresAt);
}

/** Expires an attempt using its entitlement-bounded timer. */
export async function expireAttemptAtEffectiveTime(
  ctx: MutationCtx,
  args: { attempt: TryoutAttempt; now: number }
) {
  const expiresAt = getAttemptExpiresAt(args.attempt);

  if (expiresAt === args.attempt.expiresAt) {
    return expireAttempt(ctx, args);
  }

  await ctx.db.patch(args.attempt._id, {
    expiresAt,
    lastActivityAt: args.now,
  });

  const currentAttempt = await ctx.db.get(args.attempt._id);

  if (!currentAttempt) {
    throw new ConvexError({
      code: "TRYOUT_ATTEMPT_NOT_FOUND",
      message: "Try-out attempt not found.",
    });
  }

  return expireAttempt(ctx, { attempt: currentAttempt, now: args.now });
}

/** Loads bounded responses for one section attempt before finalizing it. */
async function loadSectionResponses(
  ctx: MutationCtx,
  section: TryoutSectionAttempt
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

  return responses;
}

/** Creates an expired section attempt for a section the user never opened. */
async function createExpiredSectionAttempt(
  ctx: MutationCtx,
  args: {
    attempt: TryoutAttempt;
    now: number;
    snapshot: TryoutSectionSnapshot;
  }
) {
  await ctx.db.insert("tryoutSectionAttempts", {
    answeredCount: 0,
    completedAt: args.attempt.expiresAt,
    correctAnswers: 0,
    endReason: "time-expired",
    expiresAt: args.attempt.expiresAt,
    lastActivityAt: args.now,
    sectionKey: args.snapshot.sectionKey,
    sectionOrder: args.snapshot.sectionOrder,
    startedAt: args.attempt.expiresAt,
    status: "expired",
    totalQuestions: args.snapshot.questionCount,
    tryoutAttemptId: args.attempt._id,
    tryoutSectionId: args.snapshot.tryoutSectionId,
  });
}

/** Creates expired attempts for unopened sections before final scoring. */
async function createMissingExpiredSectionAttempts(
  ctx: MutationCtx,
  args: {
    attempt: TryoutAttempt;
    now: number;
    sections: TryoutSectionAttempt[];
  }
) {
  const attemptedSectionKeys = new Set(
    args.sections.map((section) => section.sectionKey)
  );

  for (const snapshot of args.attempt.sectionSnapshots) {
    if (attemptedSectionKeys.has(snapshot.sectionKey)) {
      continue;
    }

    await createExpiredSectionAttempt(ctx, {
      attempt: args.attempt,
      now: args.now,
      snapshot,
    });
  }
}

/** Finalizes one section attempt and finalizes the parent attempt if complete. */
export async function finalizeSectionAttempt(
  ctx: MutationCtx,
  args: {
    attempt: TryoutAttempt;
    endReason: TryoutEndReason;
    now: number;
    section: TryoutSectionAttempt;
  }
) {
  const sectionSummary = summarizeResponses(
    await loadSectionResponses(ctx, args.section)
  );

  await ctx.db.patch(args.section._id, {
    answeredCount: sectionSummary.answeredCount,
    completedAt: args.now,
    correctAnswers: sectionSummary.correctAnswers,
    endReason: args.endReason,
    lastActivityAt: args.now,
    status: args.endReason === "time-expired" ? "expired" : "completed",
  });

  const completedSectionKeys = Array.from(
    new Set([...args.attempt.completedSectionKeys, args.section.sectionKey])
  );
  await ctx.db.patch(args.attempt._id, {
    completedSectionKeys,
    lastActivityAt: args.now,
  });

  if (completedSectionKeys.length < args.attempt.sectionSnapshots.length) {
    return { kind: "completed" as const };
  }

  const currentAttempt = await ctx.db.get(args.attempt._id);

  if (!currentAttempt) {
    throw new ConvexError({
      code: "TRYOUT_ATTEMPT_NOT_FOUND",
      message: "Try-out attempt not found.",
    });
  }

  await finalizeAttemptScore(ctx, {
    attempt: currentAttempt,
    now: args.now,
  });

  return { kind: "completed" as const };
}

/** Expires one whole attempt and any in-progress section attempts it owns. */
export async function expireAttempt(
  ctx: MutationCtx,
  args: { attempt: TryoutAttempt; now: number }
) {
  const sections = await ctx.db
    .query("tryoutSectionAttempts")
    .withIndex("by_tryoutAttemptId_and_sectionOrder", (q) =>
      q.eq("tryoutAttemptId", args.attempt._id)
    )
    .take(args.attempt.sectionSnapshots.length + 1);

  if (sections.length > args.attempt.sectionSnapshots.length) {
    throw new ConvexError({
      code: "TRYOUT_SECTION_ATTEMPT_COUNT_EXCEEDED",
      message: "Try-out section attempt count exceeds the attempt snapshot.",
    });
  }

  for (const section of sections) {
    if (section.status !== "in-progress") {
      continue;
    }

    const summary = summarizeResponses(
      await loadSectionResponses(ctx, section)
    );

    await ctx.db.patch(section._id, {
      answeredCount: summary.answeredCount,
      completedAt: args.attempt.expiresAt,
      correctAnswers: summary.correctAnswers,
      endReason: "time-expired",
      lastActivityAt: args.now,
      status: "expired",
    });
  }

  await createMissingExpiredSectionAttempts(ctx, {
    attempt: args.attempt,
    now: args.now,
    sections,
  });

  await ctx.db.patch(args.attempt._id, {
    completedSectionKeys: args.attempt.sectionSnapshots.map(
      (section) => section.sectionKey
    ),
    lastActivityAt: args.now,
  });

  const currentAttempt = await ctx.db.get(args.attempt._id);

  if (!currentAttempt) {
    throw new ConvexError({
      code: "TRYOUT_ATTEMPT_NOT_FOUND",
      message: "Try-out attempt not found.",
    });
  }

  return finalizeAttemptScore(ctx, {
    attempt: currentAttempt,
    now: args.now,
  });
}
