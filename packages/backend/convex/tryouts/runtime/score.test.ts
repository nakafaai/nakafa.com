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
const SECTION_IDENTITY = tryoutCatalogIdentity({
  countryKey: "indonesia",
  examKey: "snbt",
  kind: "section",
  locale: "id",
  sectionKey: SECTION_KEY,
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
            questionSourcePath: SECTION_SOURCE,
            sectionIdentity: SECTION_IDENTITY,
            sectionKey: SECTION_KEY,
            sectionOrder: 1,
            sectionRowHash: "section-row-hash",
            sourceRevision: "2026",
            timeLimitSeconds: 1800,
          },
        ],
        setIdentity: SET_IDENTITY,
        setKey: "set-1",
        setPublicPath: SET_ROUTE,
        snapshotReleaseId: FROZEN_RELEASE_ID,
        startedAt: NOW - 20_000,
        status: "in-progress",
        totalCorrect: 0,
        totalQuestions: 1,
        trackKey: TRACK_KEY,
        tryoutSnapshotId: SNAPSHOT_ID,
        userId,
      });
      const sectionAttemptId = await ctx.db.insert("tryoutSectionAttempts", {
        answeredCount: 1,
        completedAt: NOW - 1000,
        correctAnswers: 1,
        endReason: null,
        expiresAt: NOW + 10_000,
        lastActivityAt: NOW - 1000,
        sectionIdentity: SECTION_IDENTITY,
        sectionKey: SECTION_KEY,
        sectionOrder: 1,
        startedAt: NOW - 20_000,
        status: "completed",
        totalQuestions: 1,
        tryoutAttemptId: attemptId,
      });
      const placementId = await ctx.db.insert("tryoutAttemptPlacements", {
        answerArtifactHash: "answer-artifact-hash",
        answerContentKey: `${SECTION_SOURCE}/question-1/answer`,
        choiceSnapshots: [
          {
            isCorrect: true,
            label: "A",
            optionKey: "a",
            order: 1,
          },
        ],
        contentHash: "question-hash",
        placementIdentity: `${SECTION_IDENTITY}:question-1`,
        placementRowHash: "placement-row-hash",
        questionArtifactHash: "question-artifact-hash",
        questionContentKey: `${SECTION_SOURCE}/question-1/question`,
        questionOrder: 1,
        rendererDomain: "snbt-math",
        sectionIdentity: SECTION_IDENTITY,
        sectionKey: SECTION_KEY,
        sourcePath: `${SECTION_SOURCE}/question-1`,
        sourceRevision: "2026",
        title: "Question",
        tryoutAttemptId: attemptId,
      });

      await ctx.db.insert("tryoutResponses", {
        answeredAt: NOW - 500,
        isCorrect: true,
        placementId,
        selectedOptionId: "a",
        timeSpent: 1000,
        tryoutAttemptId: attemptId,
        tryoutSectionAttemptId: sectionAttemptId,
        updatedAt: NOW - 500,
      });
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
