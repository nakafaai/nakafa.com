import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { finalizeSectionAttempt } from "@repo/backend/convex/tryouts/runtime/finish";
import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 6, 12, 12, 0, 0);
const SOURCE = "question-bank/tryout/indonesia/tka/matematika/set-1/matematika";
const SET_PATH = "try-out/indonesia/tka/matematika/set-1";

describe("tryouts/runtime/terminal", () => {
  it("completes the parent when its final section reaches its own deadline", async () => {
    const t = convexTest(schema, convexModules);

    const snapshot = await t.mutation(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "auth-section-timeout",
        credits: 0,
        creditsResetAt: NOW,
        email: "section-timeout@example.com",
        name: "Section Timeout",
        plan: "pro",
      });
      const questionSetId = await ctx.db.insert("questionSets", {
        contentHash: "question-set-hash",
        countryKey: "indonesia",
        examKey: "tka",
        locale: "id",
        questionCount: 1,
        sectionKey: "matematika",
        setKey: "set-1",
        sourcePath: SOURCE,
        sourceRevision: "2026",
        syncedAt: NOW,
        title: "Matematika",
      });
      const tryoutSetId = await ctx.db.insert("tryoutSets", {
        countryKey: "indonesia",
        examKey: "tka",
        internalEntrySectionKey: "matematika",
        isActive: true,
        isReady: true,
        locale: "id",
        order: 1,
        publicPath: SET_PATH,
        readyQuestionCount: 1,
        readyVisibleSectionCount: 0,
        scoringStrategy: "raw",
        sectionCount: 1,
        setKey: "set-1",
        sourceRevision: "2026",
        syncedAt: NOW,
        title: "Set 1",
        totalQuestionCount: 1,
        trackKey: "matematika",
        visibleSectionCount: 0,
      });
      const tryoutSectionId = await ctx.db.insert("tryoutSections", {
        countryKey: "indonesia",
        examKey: "tka",
        locale: "id",
        order: 1,
        questionCount: 1,
        questionSetId,
        questionSourcePath: SOURCE,
        sectionKey: "matematika",
        setKey: "set-1",
        sourceRevision: "2026",
        syncedAt: NOW,
        timeLimitSeconds: 3600,
        title: "Matematika",
        trackKey: "matematika",
        tryoutSetId,
        visibility: "internal-entry",
      });
      const attemptId = await ctx.db.insert("tryoutAttempts", {
        attemptNumber: 1,
        completedAt: null,
        completedSectionKeys: [],
        endReason: null,
        expiresAt: NOW + 86_400_000,
        lastActivityAt: NOW - 1000,
        scoreStatus: "official",
        scoringStrategy: "raw",
        sectionSnapshots: [
          {
            questionCount: 1,
            questionSetId,
            questionSourcePath: SOURCE,
            sectionKey: "matematika",
            sectionOrder: 1,
            sourceRevision: "2026",
            timeLimitSeconds: 3600,
            tryoutSectionId,
          },
        ],
        startedAt: NOW - 3_600_000,
        status: "in-progress",
        totalCorrect: 0,
        totalQuestions: 1,
        tryoutSetId,
        userId,
      });
      const sectionId = await ctx.db.insert("tryoutSectionAttempts", {
        answeredCount: 0,
        completedAt: null,
        correctAnswers: 0,
        endReason: null,
        expiresAt: NOW,
        lastActivityAt: NOW - 1000,
        sectionKey: "matematika",
        sectionOrder: 1,
        startedAt: NOW - 3_600_000,
        status: "in-progress",
        totalQuestions: 1,
        tryoutAttemptId: attemptId,
        tryoutSectionId,
      });
      const attempt = await ctx.db.get(attemptId);
      const section = await ctx.db.get(sectionId);

      if (!(attempt && section)) {
        throw new ConvexError({
          code: "TRYOUT_FIXTURE_INCOMPLETE",
          message: "Expected try-out attempt and section fixtures.",
        });
      }

      await finalizeSectionAttempt(ctx, {
        attempt,
        endReason: "time-expired",
        now: NOW,
        section,
      });

      const finalizedAttempt = await ctx.db.get(attemptId);
      const finalizedSection = await ctx.db.get(sectionId);
      const score = await ctx.db
        .query("tryoutScores")
        .withIndex("by_tryoutAttemptId", (q) =>
          q.eq("tryoutAttemptId", attemptId)
        )
        .unique();
      const progress = await ctx.db
        .query("tryoutSetProgress")
        .withIndex("by_userId_and_tryoutSetId", (q) =>
          q.eq("userId", userId).eq("tryoutSetId", tryoutSetId)
        )
        .unique();

      return { finalizedAttempt, finalizedSection, progress, score };
    });

    expect(snapshot.finalizedSection).toMatchObject({
      endReason: "time-expired",
      score: {
        publishedScore: 0,
        scoreStatus: "official",
        scoringStrategy: "raw",
      },
      status: "expired",
    });
    expect(snapshot.finalizedAttempt).toMatchObject({
      completedSectionKeys: ["matematika"],
      endReason: "submitted",
      status: "completed",
    });
    expect(snapshot.score).toMatchObject({
      publishedScore: 0,
      scoringStrategy: "raw",
      totalCorrect: 0,
      totalQuestions: 1,
    });
    expect(snapshot.progress).toMatchObject({
      status: "completed",
      statusRank: 2,
    });
  });
});
