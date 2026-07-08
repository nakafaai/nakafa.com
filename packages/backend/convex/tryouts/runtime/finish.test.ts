import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { expireAttempt } from "@repo/backend/convex/tryouts/runtime/finish";
import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 6, 7, 12, 0, 0);
const EXPIRED_AT = NOW - 1000;

/** Inserts one question set with one question and two choices. */
async function insertSectionSource(
  ctx: MutationCtx,
  args: {
    order: number;
    sectionKey: string;
    title: string;
  }
) {
  const sourcePath = `question-bank/tryout/indonesia/snbt/set-1/${args.sectionKey}`;
  const questionSetId = await ctx.db.insert("questionSets", {
    contentHash: `${args.sectionKey}:set-hash`,
    countryKey: "indonesia",
    examKey: "snbt",
    locale: "id",
    questionCount: 1,
    sectionKey: args.sectionKey,
    setKey: "set-1",
    sourcePath,
    sourceRevision: "2026",
    syncedAt: NOW,
    title: args.title,
  });
  const questionId = await ctx.db.insert("questions", {
    answerBody: `${args.title} answer`,
    contentHash: `${args.sectionKey}:question-hash`,
    date: 0,
    locale: "id",
    number: args.order,
    questionBody: `${args.title} question`,
    questionSetId,
    sourceKey: `${sourcePath}:question-1`,
    sourcePath: `${sourcePath}/question-1`,
    sourceRevision: "2026",
    syncedAt: NOW,
    title: `${args.title} Question`,
  });

  await ctx.db.insert("questionChoices", {
    isCorrect: true,
    label: "A",
    locale: "id",
    optionKey: "a",
    order: 1,
    questionId,
  });
  await ctx.db.insert("questionChoices", {
    isCorrect: false,
    label: "B",
    locale: "id",
    optionKey: "b",
    order: 2,
    questionId,
  });

  return {
    questionId,
    questionSetId,
    sourcePath,
  };
}

/** Inserts one try-out section backed by an already inserted source. */
async function insertTryoutSection(
  ctx: MutationCtx,
  args: {
    order: number;
    questionSetId: Id<"questionSets">;
    sectionKey: string;
    sourcePath: string;
    title: string;
    tryoutSetId: Id<"tryoutSets">;
  }
) {
  return await ctx.db.insert("tryoutSections", {
    countryKey: "indonesia",
    examKey: "snbt",
    locale: "id",
    order: args.order,
    publicPath: `try-out/indonesia/snbt/set-1/${args.sectionKey}`,
    questionCount: 1,
    questionSetId: args.questionSetId,
    questionSourcePath: args.sourcePath,
    sectionKey: args.sectionKey,
    setKey: "set-1",
    sourceRevision: "2026",
    syncedAt: NOW,
    timeLimitSeconds: 1800,
    title: args.title,
    tryoutSetId: args.tryoutSetId,
  });
}

/** Inserts one completed calibration run and item for a question. */
async function insertScaleItem(
  ctx: MutationCtx,
  args: {
    contentHash: string;
    questionId: Id<"questions">;
    questionSourceKey: string;
    scaleVersionId: Id<"irtScaleVersions">;
    sectionId: Id<"tryoutSections">;
  }
) {
  const calibrationRunId = await ctx.db.insert("irtCalibrationRuns", {
    attemptCount: 0,
    completedAt: NOW,
    iterationCount: 0,
    maxParameterDelta: 0,
    model: "2pl",
    questionCount: 1,
    responseCount: 0,
    startedAt: NOW,
    status: "completed",
    tryoutSectionId: args.sectionId,
    updatedAt: NOW,
  });

  await ctx.db.insert("irtScaleItems", {
    calibrationRunId,
    calibrationStatus: "provisional",
    contentHash: args.contentHash,
    correctRate: 0,
    difficulty: 0,
    discrimination: 1,
    questionId: args.questionId,
    questionSourceKey: args.questionSourceKey,
    responseCount: 0,
    scaleVersionId: args.scaleVersionId,
    sourceRevision: "2026",
  });
}

describe("tryouts/runtime/finish", () => {
  it("expires unopened IRT sections as unanswered before scoring", async () => {
    const t = convexTest(schema, convexModules);

    const snapshot = await t.mutation(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "auth-expire-irt",
        credits: 0,
        creditsResetAt: NOW,
        email: "expire-irt@example.com",
        name: "Expire IRT",
        plan: "pro",
      });
      const firstSource = await insertSectionSource(ctx, {
        order: 1,
        sectionKey: "pengetahuan-kuantitatif",
        title: "Pengetahuan Kuantitatif",
      });
      const secondSource = await insertSectionSource(ctx, {
        order: 2,
        sectionKey: "penalaran-matematika",
        title: "Penalaran Matematika",
      });
      const tryoutSetId = await ctx.db.insert("tryoutSets", {
        countryKey: "indonesia",
        examKey: "snbt",
        isActive: true,
        locale: "id",
        order: 1,
        publicPath: "try-out/indonesia/snbt/set-1",
        scoringStrategy: "irt",
        sectionCount: 2,
        setKey: "set-1",
        sourceRevision: "2026",
        syncedAt: NOW,
        title: "Set 1",
        totalQuestionCount: 2,
      });
      const firstSectionId = await insertTryoutSection(ctx, {
        order: 1,
        questionSetId: firstSource.questionSetId,
        sectionKey: "pengetahuan-kuantitatif",
        sourcePath: firstSource.sourcePath,
        title: "Pengetahuan Kuantitatif",
        tryoutSetId,
      });
      const secondSectionId = await insertTryoutSection(ctx, {
        order: 2,
        questionSetId: secondSource.questionSetId,
        sectionKey: "penalaran-matematika",
        sourcePath: secondSource.sourcePath,
        title: "Penalaran Matematika",
        tryoutSetId,
      });
      const scaleVersionId = await ctx.db.insert("irtScaleVersions", {
        model: "2pl",
        publishedAt: NOW,
        questionCount: 2,
        status: "provisional",
        tryoutSetId,
      });

      await insertScaleItem(ctx, {
        contentHash: "pengetahuan-kuantitatif:question-hash",
        questionId: firstSource.questionId,
        questionSourceKey: `${firstSource.sourcePath}:question-1`,
        scaleVersionId,
        sectionId: firstSectionId,
      });
      await insertScaleItem(ctx, {
        contentHash: "penalaran-matematika:question-hash",
        questionId: secondSource.questionId,
        questionSourceKey: `${secondSource.sourcePath}:question-1`,
        scaleVersionId,
        sectionId: secondSectionId,
      });

      const attemptId = await ctx.db.insert("tryoutAttempts", {
        attemptNumber: 1,
        completedAt: null,
        completedSectionKeys: [],
        endReason: null,
        expiresAt: EXPIRED_AT,
        lastActivityAt: NOW - 10_000,
        scaleVersionId,
        scoreStatus: "provisional",
        scoringStrategy: "irt",
        sectionSnapshots: [
          {
            publicPath: "try-out/indonesia/snbt/set-1/pengetahuan-kuantitatif",
            questionCount: 1,
            questionSetId: firstSource.questionSetId,
            questionSourcePath: firstSource.sourcePath,
            sectionKey: "pengetahuan-kuantitatif",
            sectionOrder: 1,
            sourceRevision: "2026",
            tryoutSectionId: firstSectionId,
          },
          {
            publicPath: "try-out/indonesia/snbt/set-1/penalaran-matematika",
            questionCount: 1,
            questionSetId: secondSource.questionSetId,
            questionSourcePath: secondSource.sourcePath,
            sectionKey: "penalaran-matematika",
            sectionOrder: 2,
            sourceRevision: "2026",
            tryoutSectionId: secondSectionId,
          },
        ],
        startedAt: NOW - 20_000,
        status: "in-progress",
        totalCorrect: 0,
        totalQuestions: 2,
        tryoutSetId,
        userId,
      });
      const sectionAttemptId = await ctx.db.insert("tryoutSectionAttempts", {
        answeredCount: 0,
        completedAt: null,
        correctAnswers: 0,
        endReason: null,
        expiresAt: EXPIRED_AT,
        lastActivityAt: NOW - 10_000,
        sectionKey: "pengetahuan-kuantitatif",
        sectionOrder: 1,
        startedAt: NOW - 20_000,
        status: "in-progress",
        totalQuestions: 1,
        tryoutAttemptId: attemptId,
        tryoutSectionId: firstSectionId,
      });
      const placementId = await ctx.db.insert("tryoutAttemptPlacements", {
        choiceSnapshots: [
          {
            isCorrect: true,
            label: "A",
            optionKey: "a",
            order: 1,
          },
          {
            isCorrect: false,
            label: "B",
            optionKey: "b",
            order: 2,
          },
        ],
        contentHash: "pengetahuan-kuantitatif:question-hash",
        questionId: firstSource.questionId,
        questionOrder: 1,
        questionSourceKey: `${firstSource.sourcePath}:question-1`,
        sourcePath: `${firstSource.sourcePath}/question-1`,
        sourceRevision: "2026",
        title: "Pengetahuan Kuantitatif Question",
        tryoutAttemptId: attemptId,
        tryoutSectionAttemptId: sectionAttemptId,
        tryoutSectionId: firstSectionId,
      });

      await ctx.db.insert("tryoutResponses", {
        answeredAt: NOW - 5000,
        isCorrect: true,
        placementId,
        questionId: firstSource.questionId,
        selectedOptionId: "a",
        timeSpent: 1000,
        tryoutAttemptId: attemptId,
        tryoutSectionAttemptId: sectionAttemptId,
        updatedAt: NOW - 5000,
      });

      await ctx.db.delete(secondSectionId);

      const attempt = await ctx.db.get(attemptId);

      if (!attempt) {
        throw new ConvexError({
          code: "TRYOUT_ATTEMPT_NOT_FOUND",
          message: "Expected try-out attempt.",
        });
      }

      await expireAttempt(ctx, { attempt, now: NOW });

      const sections = await ctx.db
        .query("tryoutSectionAttempts")
        .withIndex("by_tryoutAttemptId_and_sectionOrder", (q) =>
          q.eq("tryoutAttemptId", attemptId)
        )
        .collect();
      const placements = await ctx.db
        .query("tryoutAttemptPlacements")
        .withIndex("by_tryoutAttemptId_and_questionOrder", (q) =>
          q.eq("tryoutAttemptId", attemptId)
        )
        .collect();
      const score = await ctx.db
        .query("tryoutScores")
        .withIndex("by_tryoutAttemptId", (q) =>
          q.eq("tryoutAttemptId", attemptId)
        )
        .unique();
      const expiredAttempt = await ctx.db.get(attemptId);

      return {
        expiredAttempt,
        placements,
        score,
        sections,
      };
    });

    expect(snapshot.expiredAttempt).toMatchObject({
      completedSectionKeys: ["pengetahuan-kuantitatif", "penalaran-matematika"],
      status: "expired",
      totalCorrect: 1,
    });
    expect(snapshot.sections).toHaveLength(2);
    expect(snapshot.sections[1]).toMatchObject({
      answeredCount: 0,
      correctAnswers: 0,
      endReason: "time-expired",
      sectionKey: "penalaran-matematika",
      status: "expired",
    });
    expect(snapshot.placements).toHaveLength(1);
    expect(snapshot.score).toMatchObject({
      rawScore: 50,
      scoringStrategy: "irt",
      totalCorrect: 1,
      totalQuestions: 2,
    });
  });
});
