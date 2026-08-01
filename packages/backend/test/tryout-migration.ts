import type { ContentLocale } from "@nakafa/aksara-contracts/content";
import { TryoutCatalogRowSchema } from "@nakafa/aksara-contracts/tryout/spec";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import {
  activateTryoutSnapshot,
  makeTryoutPlacementRow,
} from "@repo/backend/test/tryout-snapshot";
import {
  insertTryoutQuestionSource,
  insertTryoutSection,
  insertTryoutSet,
  TRYOUT_SET_PATH,
} from "@repo/backend/test/tryouts";
import { Schema } from "effect";

export const TRYOUT_MIGRATION_NOW = Date.UTC(2026, 7, 1, 12);
export const TRYOUT_MIGRATION_COUNTS = {
  attempts: 1,
  calibrationAttempts: 0,
  calibrationCache: 0,
  calibrationQueue: 0,
  calibrationRuns: 1,
  irtItems: 1,
  leaderboardEntries: 0,
  leaderboardScopes: 0,
  placements: 1,
  progress: 1,
  publicationQueue: 0,
  qualityChecks: 0,
  qualityQueue: 0,
  responses: 1,
  scaleVersions: 1,
  scores: 1,
  sectionAttempts: 1,
};

const SECTION_KEY = "quantitative-knowledge";
const SECTION_PATH = `${TRYOUT_SET_PATH}/${SECTION_KEY}`;
const SOURCE_ROOT =
  "question-bank/tryout/indonesia/snbt/quantitative-knowledge/set-1";

/** Builds one bounded operator page for the technical migration graph. */
export function makeTryoutMigrationArgs(snapshotId: string, apply = true) {
  return {
    apply,
    expectedProcessed: 0,
    expectedSnapshotId: snapshotId,
    expectedTotal: 1,
    paginationOpts: { cursor: null, numItems: 50 },
  };
}

/** Inserts one complete legacy try-out graph aligned with a signed snapshot. */
export async function seedTryoutMigration(ctx: MutationCtx) {
  const catalog = [...makeCatalog("en"), ...makeCatalog("id")];
  const enPlacement = makePlacement("en");
  const idPlacement = makePlacement("id");
  const snapshotId = await activateTryoutSnapshot(ctx, {
    catalog,
    placements: [enPlacement, idPlacement],
  });
  const identity = await seedAuthenticatedUser(ctx, {
    now: TRYOUT_MIGRATION_NOW,
    suffix: "tryout-migration",
  });
  const tryoutSetId = await insertTryoutSet(ctx, {
    publicPath: TRYOUT_SET_PATH,
  });
  const questionSetId = await insertTryoutQuestionSource(ctx, {
    sectionKey: SECTION_KEY,
    sourcePath: SOURCE_ROOT,
    sourceRevision: "2026",
    withQuestion: false,
  });
  const questionId = await ctx.db.insert("questions", {
    answerBody: "Technical answer",
    contentHash: idPlacement.contentHash,
    date: 0,
    locale: "id",
    number: 1,
    questionBody: "Technical question",
    questionSetId,
    sourceKey: `${SOURCE_ROOT}:question-1`,
    sourcePath: `${SOURCE_ROOT}/question-1`,
    sourceRevision: "2026",
    syncedAt: TRYOUT_MIGRATION_NOW,
    title: idPlacement.title,
  });
  const tryoutSectionId = await insertTryoutSection(ctx, {
    publicPath: SECTION_PATH,
    questionSetId,
    questionSourcePath: SOURCE_ROOT,
    sectionKey: SECTION_KEY,
    sourceRevision: "2026",
    tryoutSetId,
  });
  const attemptId = await ctx.db.insert("tryoutAttempts", {
    accessEndsAt: TRYOUT_MIGRATION_NOW + 3_600_000,
    accessSourceKind: "free",
    attemptNumber: 1,
    completedAt: TRYOUT_MIGRATION_NOW + 1000,
    completedSectionKeys: [SECTION_KEY],
    countsForCompetition: false,
    endReason: "submitted",
    expiresAt: TRYOUT_MIGRATION_NOW + 3_600_000,
    lastActivityAt: TRYOUT_MIGRATION_NOW + 1000,
    scoreStatus: "official",
    scoringStrategy: "irt",
    sectionSnapshots: [
      {
        publicPath: SECTION_PATH,
        questionCount: 1,
        questionSetId,
        questionSourcePath: SOURCE_ROOT,
        sectionKey: SECTION_KEY,
        sectionOrder: 1,
        sourceRevision: "2026",
        timeLimitSeconds: 1800,
        tryoutSectionId,
      },
    ],
    startedAt: TRYOUT_MIGRATION_NOW,
    status: "completed",
    totalCorrect: 1,
    totalQuestions: 1,
    tryoutSetId,
    userId: identity.userId,
  });
  await ctx.db.insert("tryoutSetProgress", {
    attemptNumber: 1,
    countryKey: "indonesia",
    examKey: "snbt",
    latestAttemptId: attemptId,
    locale: "id",
    publishedScore: 1000,
    setKey: "set-1",
    status: "completed",
    statusRank: 3,
    trackKey: "2027",
    tryoutSetId,
    updatedAt: TRYOUT_MIGRATION_NOW,
    userId: identity.userId,
  });
  const sectionAttemptId = await ctx.db.insert("tryoutSectionAttempts", {
    answeredCount: 1,
    completedAt: TRYOUT_MIGRATION_NOW + 1000,
    correctAnswers: 1,
    endReason: "submitted",
    expiresAt: TRYOUT_MIGRATION_NOW + 3_600_000,
    lastActivityAt: TRYOUT_MIGRATION_NOW + 1000,
    sectionKey: SECTION_KEY,
    sectionOrder: 1,
    startedAt: TRYOUT_MIGRATION_NOW,
    status: "completed",
    totalQuestions: 1,
    tryoutAttemptId: attemptId,
    tryoutSectionId,
  });
  const placementId = await ctx.db.insert("tryoutAttemptPlacements", {
    choiceSnapshots: [...idPlacement.choices],
    contentHash: idPlacement.contentHash,
    questionId,
    questionOrder: 1,
    questionSourceKey: `${SOURCE_ROOT}:question-1`,
    sourcePath: `${SOURCE_ROOT}/question-1`,
    sourceRevision: "2026",
    title: idPlacement.title,
    tryoutAttemptId: attemptId,
    tryoutSectionId,
  });
  await ctx.db.insert("tryoutResponses", {
    answeredAt: TRYOUT_MIGRATION_NOW,
    isCorrect: true,
    placementId,
    questionId,
    selectedOptionId: "option-1",
    timeSpent: 10,
    tryoutAttemptId: attemptId,
    tryoutSectionAttemptId: sectionAttemptId,
    updatedAt: TRYOUT_MIGRATION_NOW,
  });
  await ctx.db.insert("tryoutScores", {
    finalizedAt: TRYOUT_MIGRATION_NOW + 1000,
    publishedScore: 1000,
    rawScore: 1000,
    scoreStatus: "official",
    scoringStrategy: "irt",
    totalCorrect: 1,
    totalQuestions: 1,
    tryoutAttemptId: attemptId,
    tryoutSetId,
    userId: identity.userId,
  });
  const scaleVersionId = await ctx.db.insert("irtScaleVersions", {
    model: "2pl",
    publishedAt: TRYOUT_MIGRATION_NOW,
    questionCount: 1,
    status: "official",
    tryoutSetId,
  });
  const calibrationRunId = await ctx.db.insert("irtCalibrationRuns", {
    attemptCount: 1,
    completedAt: TRYOUT_MIGRATION_NOW,
    iterationCount: 1,
    maxParameterDelta: 0,
    model: "2pl",
    questionCount: 1,
    responseCount: 1,
    startedAt: TRYOUT_MIGRATION_NOW,
    status: "completed",
    tryoutSectionId,
    updatedAt: TRYOUT_MIGRATION_NOW,
  });
  const irtItemId = await ctx.db.insert("irtScaleItems", {
    calibrationRunId,
    calibrationStatus: "calibrated",
    contentHash: idPlacement.contentHash,
    correctRate: 1,
    difficulty: 0,
    discrimination: 1,
    questionId,
    questionSourceKey: `${SOURCE_ROOT}:question-1`,
    responseCount: 1,
    scaleVersionId,
    sourceRevision: "2026",
  });

  return {
    irtItemId,
    placementId,
    questionId,
    snapshotId,
    tryoutSectionId,
  };
}

/** Aligns one complete catalog locale with the frozen legacy revision. */
function makeCatalog(locale: ContentLocale) {
  return Schema.decodeUnknownSync(Schema.Array(TryoutCatalogRowSchema))([
    {
      countryKey: "indonesia",
      examKey: "snbt",
      graph: makeGraph(locale, "set"),
      kind: "set",
      locale,
      order: 1,
      publicPath: TRYOUT_SET_PATH,
      questionCount: 1,
      scoringStrategy: "irt",
      sectionCount: 1,
      setKey: "set-1",
      sourceRevision: "2026",
      title: "Set 1",
      trackKey: "2027",
      visibleSectionCount: 1,
    },
    {
      countryKey: "indonesia",
      examKey: "snbt",
      graph: makeGraph(locale, "section"),
      kind: "section",
      locale,
      order: 1,
      publicPath: SECTION_PATH,
      questionCount: 1,
      questionSourcePath: `packages/corpus/${SOURCE_ROOT}`,
      sectionKey: SECTION_KEY,
      setKey: "set-1",
      sourceRevision: "2026",
      timeLimitSeconds: 1800,
      title: locale === "en" ? "Technical section" : "Penalaran Matematika",
      trackKey: "2027",
      visibility: "visible",
    },
  ]);
}

/** Builds stable graph identities for one technical catalog row. */
function makeGraph(locale: ContentLocale, suffix: string) {
  return {
    alignmentId: `alignment:tryout:migration:${suffix}`,
    assetId: `asset:${locale}:tryout:migration:${suffix}`,
    conceptId: `concept:tryout:migration:${suffix}`,
    learningObjectId: `lo:tryout-migration-${suffix}`,
    lensId: "lens:tryout:migration",
  };
}

/** Aligns one signed placement with the frozen legacy revision. */
function makePlacement(locale: "en" | "id") {
  return {
    ...makeTryoutPlacementRow(locale).record.row,
    sourceRevision: "2026",
  };
}
