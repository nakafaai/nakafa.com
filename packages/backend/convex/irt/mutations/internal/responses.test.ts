import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 3, 4, 10, 0, 0);

/** Insert one test user for calibration sync tests. */
async function insertUser(ctx: MutationCtx, suffix: string) {
  return await ctx.db.insert("users", {
    email: `${suffix}@example.com`,
    authId: `auth-${suffix}`,
    name: `User ${suffix}`,
    plan: "free",
    credits: 0,
    creditsResetAt: NOW,
  });
}

/** Insert one exercise set with exactly one question. */
async function insertSetWithQuestion(ctx: MutationCtx, slugSuffix: string) {
  const setId = await ctx.db.insert("exerciseSets", {
    locale: "id",
    slug: `exercises/high-school/snbt/quantitative-knowledge/try-out/2026/${slugSuffix}`,
    category: "high-school",
    type: "snbt",
    material: "quantitative-knowledge",
    exerciseType: "try-out",
    setName: slugSuffix,
    title: `Set ${slugSuffix}`,
    questionCount: 1,
    syncedAt: NOW,
  });
  const questionId = await ctx.db.insert("exerciseQuestions", {
    setId,
    locale: "id",
    slug: `question-${slugSuffix}`,
    category: "high-school",
    type: "snbt",
    material: "quantitative-knowledge",
    exerciseType: "try-out",
    setName: slugSuffix,
    number: 1,
    title: `Question ${slugSuffix}`,
    date: NOW,
    questionBody: "Question body",
    answerBody: "Answer body",
    contentHash: `hash-${slugSuffix}`,
    syncedAt: NOW,
  });

  return {
    questionId,
    setId,
  };
}

/** Insert one completed simulation set attempt for a single-question set. */
async function insertCompletedSimulationAttempt(
  ctx: MutationCtx,
  {
    setId,
    slugSuffix,
  }: {
    setId: Id<"exerciseSets">;
    slugSuffix: string;
  }
) {
  const userId = await insertUser(ctx, `responses-${slugSuffix}`);
  const set = await ctx.db.get("exerciseSets", setId);

  if (!set) {
    throw new Error("Expected exercise set to exist");
  }

  return await ctx.db.insert("exerciseAttempts", {
    slug: set.slug,
    userId,
    origin: "standalone",
    mode: "simulation",
    scope: "set",
    timeLimit: 90,
    startedAt: NOW - 60_000,
    lastActivityAt: NOW,
    completedAt: NOW,
    endReason: "submitted",
    status: "completed",
    updatedAt: NOW,
    totalExercises: 1,
    answeredCount: 1,
    correctAnswers: 1,
    totalTime: 45,
    scorePercentage: 100,
  });
}

describe("irt/mutations/internal/responses", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("syncs one completed simulation attempt into cache and queue ownership", async () => {
    const t = convexTest(schema, convexModules);

    const result = await t.mutation(async (ctx) => {
      const { questionId, setId } = await insertSetWithQuestion(ctx, "sync");
      const attemptId = await insertCompletedSimulationAttempt(ctx, {
        setId,
        slugSuffix: "sync",
      });

      await ctx.db.insert("exerciseAnswers", {
        attemptId,
        exerciseNumber: 1,
        questionId,
        isCorrect: true,
        timeSpent: 45,
        answeredAt: NOW,
        updatedAt: NOW,
      });

      await ctx.runMutation(
        internal.irt.mutations.internal.responses
          .syncCalibrationResponsesForAttempt,
        { attemptId }
      );

      return {
        cachedAttempt: await ctx.db
          .query("irtCalibrationAttempts")
          .withIndex("by_attemptId", (q) => q.eq("attemptId", attemptId))
          .unique(),
        queueEntry: await ctx.db
          .query("irtCalibrationQueue")
          .withIndex("by_attemptId_and_enqueuedAt", (q) =>
            q.eq("attemptId", attemptId)
          )
          .unique(),
      };
    });

    expect(result.cachedAttempt).toMatchObject({
      responses: [{ isCorrect: true }],
    });
    expect(result.queueEntry).toMatchObject({
      attemptId: result.cachedAttempt?.attemptId,
      setId: result.cachedAttempt?.setId,
    });
  });

  it("preserves the first enqueue time across repeated syncs", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = convexTest(schema, convexModules);

    const result = await t.mutation(async (ctx) => {
      const { questionId, setId } = await insertSetWithQuestion(
        ctx,
        "preserve-enqueue"
      );
      const attemptId = await insertCompletedSimulationAttempt(ctx, {
        setId,
        slugSuffix: "preserve-enqueue",
      });

      await ctx.db.insert("exerciseAnswers", {
        attemptId,
        exerciseNumber: 1,
        questionId,
        isCorrect: true,
        timeSpent: 45,
        answeredAt: NOW,
        updatedAt: NOW,
      });

      await ctx.runMutation(
        internal.irt.mutations.internal.responses
          .syncCalibrationResponsesForAttempt,
        { attemptId }
      );
      const firstQueueEntry = await ctx.db
        .query("irtCalibrationQueue")
        .withIndex("by_attemptId_and_enqueuedAt", (q) =>
          q.eq("attemptId", attemptId)
        )
        .unique();

      vi.setSystemTime(new Date(NOW + 5000));

      await ctx.runMutation(
        internal.irt.mutations.internal.responses
          .syncCalibrationResponsesForAttempt,
        { attemptId }
      );

      const secondQueueEntry = await ctx.db
        .query("irtCalibrationQueue")
        .withIndex("by_attemptId_and_enqueuedAt", (q) =>
          q.eq("attemptId", attemptId)
        )
        .unique();

      return {
        firstQueueEntry,
        secondQueueEntry,
      };
    });

    expect(result.firstQueueEntry?.enqueuedAt).toBe(NOW);
    expect(result.secondQueueEntry?.enqueuedAt).toBe(NOW);
  });

  it("removes queue ownership when the attempt no longer has scored answers", async () => {
    const t = convexTest(schema, convexModules);

    const result = await t.mutation(async (ctx) => {
      const { questionId, setId } = await insertSetWithQuestion(
        ctx,
        "remove-queue"
      );
      const attemptId = await insertCompletedSimulationAttempt(ctx, {
        setId,
        slugSuffix: "remove-queue",
      });
      const answerId = await ctx.db.insert("exerciseAnswers", {
        attemptId,
        exerciseNumber: 1,
        questionId,
        isCorrect: true,
        timeSpent: 45,
        answeredAt: NOW,
        updatedAt: NOW,
      });

      await ctx.runMutation(
        internal.irt.mutations.internal.responses
          .syncCalibrationResponsesForAttempt,
        { attemptId }
      );
      await ctx.db.delete("exerciseAnswers", answerId);
      await ctx.runMutation(
        internal.irt.mutations.internal.responses
          .syncCalibrationResponsesForAttempt,
        { attemptId }
      );

      return {
        cachedAttempt: await ctx.db
          .query("irtCalibrationAttempts")
          .withIndex("by_attemptId", (q) => q.eq("attemptId", attemptId))
          .unique(),
        queueEntry: await ctx.db
          .query("irtCalibrationQueue")
          .withIndex("by_attemptId_and_enqueuedAt", (q) =>
            q.eq("attemptId", attemptId)
          )
          .unique(),
      };
    });

    expect(result.cachedAttempt).toBeNull();
    expect(result.queueEntry).toBeNull();
  });
});
