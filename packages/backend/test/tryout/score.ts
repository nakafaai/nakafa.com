import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { tryoutCatalogNodeIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  insertTestState,
  insertZeroRelease,
} from "@repo/backend/test/content/state";
import { Effect } from "effect";

export const FROZEN_SCORE_NOW = Date.UTC(2026, 6, 7, 12, 0, 0);
export const FROZEN_SCORE_SNAPSHOT_ID = `sha256:${"a".repeat(64)}`;
const FROZEN_SCORE_BUNDLE_HASH = `sha256:${"c".repeat(64)}`;

const trackKey = "2027";
const sectionKey = "pengetahuan-kuantitatif";
const sectionSource = `question-bank/tryout/indonesia/snbt/${trackKey}/set-1/${sectionKey}`;
const setRoute = `try-out/indonesia/snbt/${trackKey}/set-1`;
const sectionRoute = `${setRoute}/${sectionKey}`;

export const FROZEN_SCORE_SET_IDENTITY = tryoutCatalogNodeIdentity({
  appLocale: AppLocaleSchema.make("id"),
  countryKey: "indonesia",
  examKey: "snbt",
  kind: "set",
  setKey: "set-1",
  trackKey,
});

const sectionIdentity = tryoutCatalogNodeIdentity({
  appLocale: AppLocaleSchema.make("id"),
  countryKey: "indonesia",
  examKey: "snbt",
  kind: "section",
  sectionKey,
  setKey: "set-1",
  trackKey,
});

const frozenReleaseId = "release-score-frozen";
const laterRelease = {
  manifestHash: `sha256:${"b".repeat(64)}`,
  releaseId: "release-score-later",
  sequence: 2,
};

/** Seeds one complete frozen-release score fixture behind a newer active release. */
export const seedFrozenTryoutScoreState = Effect.fn(
  "test.tryoutScore.seedFrozenTryoutScoreState"
)(function* (ctx: MutationCtx) {
  yield* Effect.promise(() =>
    insertZeroRelease(ctx, {
      ...laterRelease,
      ownership: { base: [], result: [] },
      role: "candidate",
      status: "completed",
    })
  );
  yield* Effect.promise(() =>
    insertTestState(ctx, {
      active: laterRelease,
      nextSequence: laterRelease.sequence + 1,
    })
  );
  const bundleId = yield* Effect.promise(() =>
    ctx.db.insert("tryoutRuntimeBundles", {
      bundleHash: FROZEN_SCORE_BUNDLE_HASH,
      bundleJson: "{}",
      cleanupReleaseId: frozenReleaseId,
      createdAt: FROZEN_SCORE_NOW,
      rendererJson: "{}",
      rendererManifestHash: `sha256:${"d".repeat(64)}`,
      snapshotId: FROZEN_SCORE_SNAPSHOT_ID,
      sourceGitSha: "e".repeat(40),
      sourceManifestHash: `sha256:${"f".repeat(64)}`,
      sourceReleaseId: frozenReleaseId,
    })
  );
  const userId = yield* Effect.promise(() =>
    ctx.db.insert("users", {
      authId: "auth-score-snapshot",
      credits: 0,
      creditsResetAt: FROZEN_SCORE_NOW,
      email: "score-snapshot@example.com",
      name: "Score Snapshot",
      plan: "pro",
    })
  );
  const attemptId = yield* Effect.promise(() =>
    ctx.db.insert("tryoutAttempts", {
      accessEndsAt: FROZEN_SCORE_NOW + 86_400_000,
      accessSourceKind: "free",
      attemptNumber: 1,
      completedAt: null,
      completedSectionKeys: [sectionKey],
      countsForCompetition: false,
      countryKey: "indonesia",
      endReason: null,
      examKey: "snbt",
      expiresAt: FROZEN_SCORE_NOW + 86_400_000,
      lastActivityAt: FROZEN_SCORE_NOW,
      appLocale: "id",
      scoreStatus: "official",
      scoringStrategy: "raw",
      sectionSnapshots: [
        {
          publicPath: sectionRoute,
          questionCount: 1,
          questionSourcePath: sectionSource,
          sectionIdentity,
          sectionKey,
          sectionOrder: 1,
          sectionRowHash: "section-row-hash",
          sourceRevision: "2026",
          timeLimitSeconds: 1800,
        },
      ],
      setIdentity: FROZEN_SCORE_SET_IDENTITY,
      setKey: "set-1",
      setPublicPath: setRoute,
      snapshotReleaseId: frozenReleaseId,
      startedAt: FROZEN_SCORE_NOW - 20_000,
      status: "in-progress",
      totalCorrect: 0,
      totalQuestions: 1,
      trackKey,
      tryoutBundleHash: FROZEN_SCORE_BUNDLE_HASH,
      tryoutBundleId: bundleId,
      tryoutSnapshotId: FROZEN_SCORE_SNAPSHOT_ID,
      userId,
    })
  );
  const sectionAttemptId = yield* Effect.promise(() =>
    ctx.db.insert("tryoutSectionAttempts", {
      answeredCount: 1,
      completedAt: FROZEN_SCORE_NOW - 1000,
      correctAnswers: 1,
      endReason: null,
      expiresAt: FROZEN_SCORE_NOW + 10_000,
      lastActivityAt: FROZEN_SCORE_NOW - 1000,
      sectionIdentity,
      sectionKey,
      sectionOrder: 1,
      startedAt: FROZEN_SCORE_NOW - 20_000,
      status: "completed",
      totalQuestions: 1,
      tryoutAttemptId: attemptId,
    })
  );
  const placementId = yield* Effect.promise(() =>
    ctx.db.insert("tryoutAttemptPlacements", {
      answerArtifactHash: "answer-artifact-hash",
      answerContentKey: `${sectionSource}/question-1/answer`,
      choiceSnapshots: [
        {
          isCorrect: true,
          label: "A",
          optionKey: "a",
          order: 1,
        },
      ],
      contentHash: "question-hash",
      placementIdentity: `${sectionIdentity}:question-1`,
      placementRowHash: "placement-row-hash",
      questionArtifactHash: "question-artifact-hash",
      questionContentKey: `${sectionSource}/question-1/question`,
      questionOrder: 1,
      rendererDomain: "snbt-math",
      sectionIdentity,
      sectionKey,
      sourcePath: `${sectionSource}/question-1`,
      sourceRevision: "2026",
      tryoutAttemptId: attemptId,
    })
  );

  yield* Effect.promise(() =>
    ctx.db.insert("tryoutResponses", {
      answeredAt: FROZEN_SCORE_NOW - 500,
      isCorrect: true,
      placementId,
      selectedOptionId: "a",
      timeSpent: 1000,
      tryoutAttemptId: attemptId,
      tryoutSectionAttemptId: sectionAttemptId,
      updatedAt: FROZEN_SCORE_NOW - 500,
    })
  );
  const attempt = yield* Effect.promise(() => ctx.db.get(attemptId));

  if (!attempt) {
    return yield* Effect.die("Expected try-out score fixture.");
  }

  return attempt;
});
