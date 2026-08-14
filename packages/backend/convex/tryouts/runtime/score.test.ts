import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { tryoutCatalogNodeIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { retainTryoutBundle } from "@repo/backend/convex/tryouts/runtime/bundle";
import { TryoutRuntimeError } from "@repo/backend/convex/tryouts/runtime/error";
import { loadAttemptPlacements } from "@repo/backend/convex/tryouts/runtime/placement";
import { loadAttemptResponses } from "@repo/backend/convex/tryouts/runtime/response";
import {
  finalizeAttemptScore,
  loadAttemptScoreSource,
  requireOwnedAttempt,
} from "@repo/backend/convex/tryouts/runtime/score";
import {
  TEST_MANIFEST_HASH,
  testReleaseJson,
  testRendererJson,
} from "@repo/backend/test/content-release";
import {
  insertTestState,
  insertZeroRelease,
} from "@repo/backend/test/content-state";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout-runtime";
import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 6, 7, 12, 0, 0);
const TRACK_KEY = "2027";
const SECTION_KEY = "pengetahuan-kuantitatif";
const SECTION_SOURCE = `question-bank/tryout/indonesia/snbt/${TRACK_KEY}/set-1/${SECTION_KEY}`;
const SET_ROUTE = `try-out/indonesia/snbt/${TRACK_KEY}/set-1`;
const SECTION_ROUTE = `${SET_ROUTE}/${SECTION_KEY}`;
const SET_IDENTITY = tryoutCatalogNodeIdentity({
  appLocale: AppLocaleSchema.make("id"),
  countryKey: "indonesia",
  examKey: "snbt",
  kind: "set",
  setKey: "set-1",
  trackKey: TRACK_KEY,
});
const SECTION_IDENTITY = tryoutCatalogNodeIdentity({
  appLocale: AppLocaleSchema.make("id"),
  countryKey: "indonesia",
  examKey: "snbt",
  kind: "section",
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

type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutEndReason = NonNullable<TryoutAttempt["endReason"]>;

/** Finalizes an attempt through the same single placement read as production. */
const finalizeLoadedAttempt = Effect.fn(
  "tryouts.runtime.test.finalizeLoadedAttempt"
)(function* (
  ctx: MutationCtx,
  args: {
    readonly attempt: TryoutAttempt;
    readonly endReason: TryoutEndReason;
    readonly now: number;
  }
) {
  const placements = yield* loadAttemptPlacements(ctx, args.attempt);
  const responseIndex = yield* loadAttemptResponses(
    ctx,
    args.attempt,
    placements,
    "complete"
  );
  const source = yield* loadAttemptScoreSource(
    ctx,
    args.attempt,
    responseIndex.placements
  );

  return yield* finalizeAttemptScore(ctx, { ...args, responseIndex, source });
});

describe("tryouts/runtime/score", () => {
  it("masks unexpected owned attempt lookup failures", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation((ctx) =>
      seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
        suffix: "score-owned-attempt-failure",
      })
    );
    const storageCause = new Error("internal tryoutAttempts storage details");

    await t.mutation(async (ctx) => {
      vi.spyOn(ctx.db, "get").mockRejectedValue(storageCause);

      const internalFailure = await Effect.runPromise(
        Effect.flip(
          requireOwnedAttempt(ctx, {
            attemptId: seeded.attemptId,
            userId: seeded.identity.userId,
          })
        )
      );

      expect(internalFailure).toMatchObject({
        cause: {
          code: "TRYOUT_RUNTIME_FAILED",
          message: "Unable to complete try-out runtime operation.",
        },
        code: "TRYOUT_RUNTIME_FAILED",
        message: "Unable to load try-out attempt.",
      });
      const lookupFailure = internalFailure.cause;
      expect(lookupFailure).toBeInstanceOf(TryoutRuntimeError);
      if (!(lookupFailure instanceof TryoutRuntimeError)) {
        throw new Error("Expected a typed lookup failure cause.");
      }
      expect(lookupFailure.cause).toBe(storageCause);

      const publicFailure = await runConvexProgram(
        requireOwnedAttempt(ctx, {
          attemptId: seeded.attemptId,
          userId: seeded.identity.userId,
        })
      ).then(
        () => null,
        (error: unknown) => error
      );

      expect(publicFailure).toMatchObject({
        data: {
          code: "TRYOUT_RUNTIME_FAILED",
          message: "Unable to load try-out attempt.",
        },
      });
      expect(JSON.stringify(publicFailure)).not.toContain(storageCause.message);
    });
  });

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
        appLocale: "id",
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
        finalizeLoadedAttempt(ctx, {
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

  it("rejects stale response correctness before terminal writes", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const fixture = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
        suffix: "score-response-integrity",
      });
      const placement = await ctx.db.get(fixture.placementId);
      if (!placement) {
        throw new Error("Expected one frozen try-out placement.");
      }
      const choice = placement.choiceSnapshots.at(0);
      if (!choice) {
        throw new Error("Expected one frozen try-out choice.");
      }
      await ctx.db.patch(fixture.attemptId, {
        scoreStatus: "official",
        scoringStrategy: "raw",
      });
      await ctx.db.insert("tryoutResponses", {
        answeredAt: NOW,
        isCorrect: !choice.isCorrect,
        placementId: placement._id,
        selectedOptionId: choice.optionKey,
        timeSpent: 0,
        tryoutAttemptId: fixture.attemptId,
        tryoutSectionAttemptId: fixture.sectionAttemptId,
        updatedAt: NOW,
      });
      return fixture;
    });

    await expect(
      t.mutation(async (ctx) => {
        const attempt = await ctx.db.get(seeded.attemptId);
        if (!attempt) {
          throw new Error("Expected one active try-out attempt.");
        }
        return await runConvexProgram(
          finalizeLoadedAttempt(ctx, {
            attempt,
            endReason: "submitted",
            now: NOW + 1000,
          })
        );
      })
    ).rejects.toMatchObject({
      data: { code: "TRYOUT_RESPONSE_CHOICE_MISMATCH" },
    });

    const stored = await t.query(async (ctx) => ({
      attempt: await ctx.db.get(seeded.attemptId),
      scores: await ctx.db.query("tryoutScores").collect(),
      section: await ctx.db.get(seeded.sectionAttemptId),
    }));
    expect(stored.scores).toEqual([]);
    expect(stored.attempt).toMatchObject({
      completedAt: null,
      endReason: null,
      status: "in-progress",
      totalCorrect: 0,
    });
    expect(stored.section).toMatchObject({
      answeredCount: 0,
      correctAnswers: 0,
      status: "in-progress",
    });
  });

  it("rejects duplicate placement identities before terminal writes", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const fixture = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
        suffix: "score-placement-identity",
      });
      const attempt = await ctx.db.get(fixture.attemptId);
      const placement = await ctx.db.get(fixture.placementId);
      const section = await ctx.db.get(fixture.sectionAttemptId);
      const snapshot = attempt?.sectionSnapshots.at(0);
      if (!(attempt && placement && section && snapshot)) {
        throw new Error("Expected a complete try-out integrity fixture.");
      }

      await ctx.db.patch(attempt._id, {
        scoreStatus: "official",
        scoringStrategy: "raw",
        sectionSnapshots: [{ ...snapshot, questionCount: 2 }],
        totalQuestions: 2,
      });
      await ctx.db.patch(section._id, { totalQuestions: 2 });
      const { _creationTime, _id, ...placementValues } = placement;
      await ctx.db.insert("tryoutAttemptPlacements", {
        ...placementValues,
        questionOrder: 2,
      });
      return fixture;
    });

    await expect(
      t.mutation(async (ctx) => {
        const attempt = await ctx.db.get(seeded.attemptId);
        if (!attempt) {
          throw new Error("Expected one active try-out attempt.");
        }
        return await runConvexProgram(
          finalizeLoadedAttempt(ctx, {
            attempt,
            endReason: "submitted",
            now: NOW + 1000,
          })
        );
      })
    ).rejects.toMatchObject({ data: { code: "TRYOUT_PLACEMENT_DUPLICATE" } });

    const stored = await t.query(async (ctx) => ({
      attempt: await ctx.db.get(seeded.attemptId),
      progress: await ctx.db.query("tryoutSetProgress").collect(),
      scores: await ctx.db.query("tryoutScores").collect(),
      section: await ctx.db.get(seeded.sectionAttemptId),
    }));
    expect(stored.scores).toEqual([]);
    expect(stored.progress).toEqual([]);
    expect(stored.attempt).toMatchObject({
      completedAt: null,
      endReason: null,
      status: "in-progress",
      totalCorrect: 0,
    });
    expect(stored.section).toMatchObject({
      answeredCount: 0,
      correctAnswers: 0,
      status: "in-progress",
    });
    expect(stored.section?.score).toBeUndefined();
  });
});
