import { tryoutCatalogIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { retainTryoutBundle } from "@repo/backend/convex/tryouts/runtime/bundle";
import { finalizeAttemptScore } from "@repo/backend/convex/tryouts/runtime/score";
import {
  TEST_MANIFEST_HASH,
  testReleaseJson,
  testRendererJson,
} from "@repo/backend/test/content-release";
import {
  insertTestState,
  insertZeroRelease,
} from "@repo/backend/test/content-state";
import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 6, 7, 12, 0, 0);
const TRACK_KEY = "2027";
const SECTION_KEY = "pengetahuan-kuantitatif";
const SECTION_SOURCE = `question-bank/tryout/indonesia/snbt/${TRACK_KEY}/set-1/${SECTION_KEY}`;
const SET_ROUTE = `try-out/indonesia/snbt/${TRACK_KEY}/set-1`;
const SECTION_ROUTE = `${SET_ROUTE}/${SECTION_KEY}`;
const SET_IDENTITY = tryoutCatalogIdentity({
  countryKey: "indonesia",
  examKey: "snbt",
  kind: "set",
  locale: "id",
  setKey: "set-1",
  trackKey: TRACK_KEY,
});
const SNAPSHOT_ID = `sha256:${"a".repeat(64)}`;
const FROZEN_RELEASE_ID = "release-score-frozen";
const LATER_RELEASE = {
  manifestHash: `sha256:${"b".repeat(64)}`,
  releaseId: "release-score-later",
  sequence: 2,
};

describe("tryouts/runtime/score", () => {
  it("scores from the frozen bundle after the active release advances", async () => {
    const t = convexTest(schema, convexModules);

    const snapshot = await t.mutation(async (ctx) => {
      await insertZeroRelease(ctx, {
        ...LATER_RELEASE,
        ownership: { base: [], result: [] },
        role: "candidate",
        status: "completed",
      });
      await insertTestState(ctx, {
        active: LATER_RELEASE,
        nextSequence: LATER_RELEASE.sequence + 1,
      });
      await runConvexProgram(
        retainTryoutBundle(
          ctx,
          {
            manifestHash: TEST_MANIFEST_HASH,
            releaseId: FROZEN_RELEASE_ID,
            releaseJson: testReleaseJson({ releaseId: FROZEN_RELEASE_ID }),
            rendererJson: testRendererJson(),
            snapshotId: SNAPSHOT_ID,
          },
          NOW
        )
      );
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
        accessEndsAt: NOW + 86_400_000,
        accessSourceKind: "free",
        attemptNumber: 1,
        completedAt: null,
        completedSectionKeys: [SECTION_KEY],
        countsForCompetition: false,
        countryKey: "indonesia",
        endReason: null,
        examKey: "snbt",
        expiresAt: NOW + 86_400_000,
        lastActivityAt: NOW,
        locale: "id",
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
            timeLimitSeconds: 1800,
            tryoutSectionId: sectionId,
          },
        ],
        setIdentity: SET_IDENTITY,
        setKey: "set-1",
        snapshotReleaseId: FROZEN_RELEASE_ID,
        startedAt: NOW - 20_000,
        status: "in-progress",
        totalCorrect: 0,
        totalQuestions: 1,
        trackKey: TRACK_KEY,
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
      await ctx.db.delete(tryoutSetId);

      const attempt = await ctx.db.get(attemptId);

      if (!attempt) {
        throw new ConvexError({
          code: "TRYOUT_ATTEMPT_NOT_FOUND",
          message: "Expected try-out attempt.",
        });
      }

      await runConvexProgram(
        finalizeAttemptScore(ctx, {
          attempt,
          endReason: "submitted",
          now: NOW,
        })
      );

      const score = await ctx.db
        .query("tryoutScores")
        .withIndex("by_tryoutAttemptId", (q) =>
          q.eq("tryoutAttemptId", attemptId)
        )
        .unique();
      const finalizedAttempt = await ctx.db.get(attemptId);

      return { finalizedAttempt, score };
    });

    expect(snapshot.finalizedAttempt).toMatchObject({
      endReason: "submitted",
      status: "completed",
    });
    expect(snapshot.score).toMatchObject({
      publishedScore: 100,
      rawScore: 100,
      scoringStrategy: "raw",
      setIdentity: SET_IDENTITY,
      totalCorrect: 1,
      totalQuestions: 1,
      tryoutSnapshotId: SNAPSHOT_ID,
    });
  });
});
