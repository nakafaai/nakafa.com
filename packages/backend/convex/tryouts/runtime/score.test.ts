import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { finalizeAttemptScore } from "@repo/backend/convex/tryouts/runtime/score";
import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 6, 7, 12, 0, 0);
const TRACK_KEY = "2027";
const SECTION_KEY = "pengetahuan-kuantitatif";
const SECTION_SOURCE = `question-bank/tryout/indonesia/snbt/${TRACK_KEY}/set-1/${SECTION_KEY}`;
const SET_ROUTE = `try-out/indonesia/snbt/${TRACK_KEY}/set-1`;
const SECTION_ROUTE = `${SET_ROUTE}/${SECTION_KEY}`;

describe("tryouts/runtime/score", () => {
  it("scores with the attempt strategy snapshot instead of the live set strategy", async () => {
    const t = convexTest(schema, convexModules);

    const snapshot = await t.mutation(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "auth-score-snapshot",
        credits: 0,
        creditsResetAt: NOW,
        email: "score-snapshot@example.com",
        name: "Score Snapshot",
        plan: "pro",
      });
      const questionSetId = await ctx.db.insert("questionSets", {
        contentHash: "question-set-hash",
        countryKey: "indonesia",
        examKey: "snbt",
        locale: "id",
        questionCount: 1,
        sectionKey: SECTION_KEY,
        setKey: "set-1",
        sourcePath: SECTION_SOURCE,
        sourceRevision: "2026",
        syncedAt: NOW,
        title: "Pengetahuan Kuantitatif",
      });
      const questionId = await ctx.db.insert("questions", {
        answerBody: "Answer",
        contentHash: "question-hash",
        date: 0,
        locale: "id",
        number: 1,
        questionBody: "Question",
        questionSetId,
        sourceKey: `${SECTION_SOURCE}:question-1`,
        sourcePath: `${SECTION_SOURCE}/question-1`,
        sourceRevision: "2026",
        syncedAt: NOW,
        title: "Question",
      });
      const tryoutSetId = await ctx.db.insert("tryoutSets", {
        countryKey: "indonesia",
        examKey: "snbt",
        isActive: true,
        isReady: true,
        locale: "id",
        order: 1,
        publicPath: SET_ROUTE,
        readyQuestionCount: 1,
        readyVisibleSectionCount: 1,
        scoringStrategy: "raw",
        sectionCount: 1,
        setKey: "set-1",
        sourceRevision: "2026",
        syncedAt: NOW,
        title: "Set 1",
        trackKey: TRACK_KEY,
        totalQuestionCount: 1,
        visibleSectionCount: 1,
      });
      const sectionId = await ctx.db.insert("tryoutSections", {
        countryKey: "indonesia",
        examKey: "snbt",
        locale: "id",
        order: 1,
        publicPath: SECTION_ROUTE,
        questionCount: 1,
        questionSetId,
        questionSourcePath: SECTION_SOURCE,
        sectionKey: SECTION_KEY,
        setKey: "set-1",
        sourceRevision: "2026",
        syncedAt: NOW,
        timeLimitSeconds: 1800,
        title: "Pengetahuan Kuantitatif",
        trackKey: TRACK_KEY,
        tryoutSetId,
        visibility: "visible",
      });
      const attemptId = await ctx.db.insert("tryoutAttempts", {
        attemptNumber: 1,
        completedAt: null,
        completedSectionKeys: [SECTION_KEY],
        endReason: null,
        expiresAt: NOW + 86_400_000,
        lastActivityAt: NOW,
        scoreStatus: "official",
        scoringStrategy: "raw",
        sectionSnapshots: [
          {
            publicPath: SECTION_ROUTE,
            questionCount: 1,
            questionSetId,
            questionSourcePath: SECTION_SOURCE,
            sectionKey: SECTION_KEY,
            sectionOrder: 1,
            sourceRevision: "2026",
            tryoutSectionId: sectionId,
          },
        ],
        startedAt: NOW - 20_000,
        status: "in-progress",
        totalCorrect: 0,
        totalQuestions: 1,
        tryoutSetId,
        userId,
      });
      const sectionAttemptId = await ctx.db.insert("tryoutSectionAttempts", {
        answeredCount: 1,
        completedAt: NOW - 1000,
        correctAnswers: 1,
        endReason: null,
        expiresAt: NOW + 10_000,
        lastActivityAt: NOW - 1000,
        sectionKey: SECTION_KEY,
        sectionOrder: 1,
        startedAt: NOW - 20_000,
        status: "completed",
        totalQuestions: 1,
        tryoutAttemptId: attemptId,
        tryoutSectionId: sectionId,
      });
      const placementId = await ctx.db.insert("tryoutAttemptPlacements", {
        choiceSnapshots: [
          {
            isCorrect: true,
            label: "A",
            optionKey: "a",
            order: 1,
          },
        ],
        contentHash: "question-hash",
        questionId,
        questionOrder: 1,
        questionSourceKey: `${SECTION_SOURCE}:question-1`,
        sourcePath: `${SECTION_SOURCE}/question-1`,
        sourceRevision: "2026",
        title: "Question",
        tryoutAttemptId: attemptId,
        tryoutSectionId: sectionId,
      });

      await ctx.db.insert("tryoutResponses", {
        answeredAt: NOW - 500,
        isCorrect: true,
        placementId,
        questionId,
        selectedOptionId: "a",
        timeSpent: 1000,
        tryoutAttemptId: attemptId,
        tryoutSectionAttemptId: sectionAttemptId,
        updatedAt: NOW - 500,
      });
      await ctx.db.patch(tryoutSetId, { scoringStrategy: "irt" });

      const attempt = await ctx.db.get(attemptId);

      if (!attempt) {
        throw new ConvexError({
          code: "TRYOUT_ATTEMPT_NOT_FOUND",
          message: "Expected try-out attempt.",
        });
      }

      await finalizeAttemptScore(ctx, { attempt, now: NOW });

      return await ctx.db
        .query("tryoutScores")
        .withIndex("by_tryoutAttemptId", (q) =>
          q.eq("tryoutAttemptId", attemptId)
        )
        .unique();
    });

    expect(snapshot).toMatchObject({
      publishedScore: 100,
      rawScore: 100,
      scoringStrategy: "raw",
      totalCorrect: 1,
      totalQuestions: 1,
    });
  });
});
