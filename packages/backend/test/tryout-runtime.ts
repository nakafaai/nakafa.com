import type { ContentLocale } from "@nakafa/aksara-contracts/content";
import {
  tryoutCatalogIdentity,
  tryoutPlacementIdentity,
} from "@nakafa/aksara-contracts/tryout/identity";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import type {
  TryoutAnswerSelector,
  TryoutQuestionSelector,
} from "@repo/backend/convex/tryouts/runtime/content";
import type { TryoutStatus } from "@repo/backend/convex/tryouts/status";
import {
  TEST_RELEASE_ID,
  testTextHash,
} from "@repo/backend/test/content-release";
import {
  type AlignedTryoutSectionFixture,
  insertTryoutSectionSource,
  makeAlignedTryoutSection,
  makeSignedTryoutSource,
} from "@repo/backend/test/tryout-section";
import { activateTryoutSnapshot } from "@repo/backend/test/tryout-snapshot";
import {
  insertTryoutSection,
  insertTryoutSet,
  TRYOUT_SECTION_KEY,
  TRYOUT_SECTION_PATH,
  TRYOUT_TEST_NOW,
} from "@repo/backend/test/tryouts";
import { ConvexError } from "convex/values";

/** Reads the filesystem section used to derive a matching signed fixture. */
async function readTryoutSection(
  ctx: MutationCtx,
  tryoutSectionId: Id<"tryoutSections">
) {
  const section = await ctx.db.get(tryoutSectionId);
  if (!section) {
    throw new ConvexError({
      code: "TRYOUT_SECTION_NOT_FOUND",
      message: "Expected the try-out section fixture.",
    });
  }
  return section;
}

/** Reads the filesystem set used to derive a matching signed fixture. */
async function readTryoutSet(ctx: MutationCtx, tryoutSetId: Id<"tryoutSets">) {
  const set = await ctx.db.get(tryoutSetId);
  if (!set) {
    throw new ConvexError({
      code: "TRYOUT_SET_NOT_FOUND",
      message: "Expected the try-out set fixture.",
    });
  }
  return set;
}

/** Returns the coherent terminal reason for one fixture status. */
function getEndReason(
  status: TryoutStatus
): Doc<"tryoutAttempts">["endReason"] {
  if (status === "in-progress") {
    return null;
  }

  if (status === "expired") {
    return "time-expired";
  }

  return "submitted";
}

/** Inserts one standard paid user for try-out runtime tests. */
export function insertTryoutUser(
  ctx: MutationCtx,
  identity: Pick<Doc<"users">, "authId" | "email" | "name">
) {
  return ctx.db.insert("users", {
    ...identity,
    credits: 0,
    creditsResetAt: TRYOUT_TEST_NOW,
    plan: "pro",
  });
}

/** Inserts one attempt and section state used by content access tests. */
export async function seedTryoutContentAccessState(
  ctx: MutationCtx,
  args: {
    attemptStatus: TryoutStatus;
    sectionStatus: TryoutStatus;
    signed?: boolean;
    suffix: string;
  }
) {
  const identity = await seedAuthenticatedUser(ctx, {
    now: TRYOUT_TEST_NOW,
    suffix: args.suffix,
  });
  const tryoutSetId = await insertTryoutSet(ctx);
  const questionSource = await insertTryoutSectionSource(
    ctx,
    TRYOUT_SECTION_KEY
  );
  const tryoutSectionId = await insertTryoutSection(ctx, {
    publicPath: TRYOUT_SECTION_PATH,
    questionSetId: questionSource.questionSetId,
    questionSourcePath: questionSource.sourcePath,
    tryoutSetId,
  });
  const attemptTerminal = args.attemptStatus !== "in-progress";
  const sectionTerminal = args.sectionStatus !== "in-progress";
  const fixtureLocale: ContentLocale = "id";
  const signedSection = makeAlignedTryoutSection(
    await readTryoutSection(ctx, tryoutSectionId)
  );
  const signedSource = makeSignedTryoutSource(
    await readTryoutSet(ctx, tryoutSetId),
    [signedSection]
  );
  const snapshotId = args.signed
    ? await activateTryoutSnapshot(ctx, {
        catalog: [
          signedSource.snapshot.set.row,
          { ...signedSource.snapshot.set.row, locale: "en" },
          signedSection.signed.section.row,
          { ...signedSection.signed.section.row, locale: "en" },
        ],
        placements: signedSection.signed.placements.flatMap(({ row }) => [
          row,
          { ...row, locale: "en" },
        ]),
      })
    : null;
  const setIdentity = tryoutCatalogIdentity({
    countryKey: "indonesia",
    examKey: "snbt",
    kind: "set",
    locale: "id",
    setKey: "set-1",
    trackKey: "2027",
  });
  const attemptId = await ctx.db.insert("tryoutAttempts", {
    accessEndsAt: TRYOUT_TEST_NOW + 3_600_000,
    accessSourceKind: "free",
    attemptNumber: 1,
    completedAt: attemptTerminal ? TRYOUT_TEST_NOW : null,
    completedSectionKeys: sectionTerminal ? [TRYOUT_SECTION_KEY] : [],
    countsForCompetition: false,
    endReason: getEndReason(args.attemptStatus),
    expiresAt: TRYOUT_TEST_NOW + 3_600_000,
    lastActivityAt: TRYOUT_TEST_NOW,
    scoreStatus: "official",
    scoringStrategy: "irt",
    sectionSnapshots: [],
    startedAt: TRYOUT_TEST_NOW,
    status: args.attemptStatus,
    totalCorrect: 0,
    totalQuestions: 1,
    tryoutSetId,
    userId: identity.userId,
    ...(snapshotId
      ? {
          countryKey: "indonesia",
          examKey: "snbt",
          locale: fixtureLocale,
          setIdentity,
          setKey: "set-1",
          setPublicPath: signedSource.snapshot.set.row.publicPath,
          snapshotReleaseId: TEST_RELEASE_ID,
          trackKey: "2027",
          tryoutSnapshotId: snapshotId,
        }
      : {}),
  });

  const sectionAttemptId = await ctx.db.insert("tryoutSectionAttempts", {
    answeredCount: 0,
    completedAt: sectionTerminal ? TRYOUT_TEST_NOW : null,
    correctAnswers: 0,
    endReason: getEndReason(args.sectionStatus),
    expiresAt: TRYOUT_TEST_NOW + 1_800_000,
    lastActivityAt: TRYOUT_TEST_NOW,
    sectionKey: TRYOUT_SECTION_KEY,
    sectionOrder: 1,
    startedAt: TRYOUT_TEST_NOW,
    status: args.sectionStatus,
    totalQuestions: 1,
    tryoutAttemptId: attemptId,
    tryoutSectionId,
  });

  if (!snapshotId) {
    return {
      attemptId,
      identity,
      placementId: null,
      sectionAttemptId,
      signedContent: null,
      tryoutSetId,
    };
  }

  const answerArtifactHash = testTextHash(`${args.suffix}:answer`);
  const questionArtifactHash = testTextHash(`${args.suffix}:question`);
  const sourcePath = `${questionSource.sourcePath}/question-1`;
  const answerContentKey = `${sourcePath}/answer`;
  const questionContentKey = `${sourcePath}/question`;
  const contentHash = questionSource.contentHash;
  const placementId = await ctx.db.insert("tryoutAttemptPlacements", {
    answerArtifactHash,
    answerContentKey,
    choiceSnapshots: [],
    contentHash,
    placementIdentity: `${args.suffix}:placement`,
    placementRowHash: testTextHash(`${args.suffix}:placement-row`),
    questionArtifactHash,
    questionContentKey,
    questionOrder: 1,
    rendererDomain: "snbt-math",
    sectionIdentity: `${args.suffix}:section`,
    sectionKey: TRYOUT_SECTION_KEY,
    sourcePath,
    sourceRevision: "2026",
    title: "Technical question",
    tryoutAttemptId: attemptId,
    tryoutSectionId,
  });

  const answer: TryoutAnswerSelector = {
    artifactHash: answerArtifactHash,
    contentHash,
    contentKey: answerContentKey,
    delivery: "entitled",
    locale: fixtureLocale,
    questionOrder: 1,
    snapshotId,
    snapshotReleaseId: TEST_RELEASE_ID,
    sourcePath,
    sourceRevision: "2026",
  };
  const question: TryoutQuestionSelector = {
    artifactHash: questionArtifactHash,
    contentHash,
    contentKey: questionContentKey,
    delivery: "authenticated",
    locale: fixtureLocale,
    questionOrder: 1,
    snapshotId,
    snapshotReleaseId: TEST_RELEASE_ID,
    sourcePath,
    sourceRevision: "2026",
  };

  return {
    attemptId,
    identity,
    placementId,
    sectionAttemptId,
    signedContent: { answer, question },
    tryoutSetId,
  };
}

/** Builds the immutable section shape stored on an attempt. */
export function tryoutSectionSnapshot(args: {
  order: number;
  publicPath: string;
  questionSetId: Id<"questionSets">;
  sectionKey: string;
  sourcePath: string;
  signed?: AlignedTryoutSectionFixture["signed"];
  tryoutSectionId?: Id<"tryoutSections">;
}) {
  return {
    publicPath: args.publicPath,
    questionCount: 1,
    questionSetId: args.questionSetId,
    questionSourcePath: args.sourcePath,
    sectionIdentity: args.signed
      ? tryoutCatalogIdentity(args.signed.section.row)
      : undefined,
    sectionKey: args.sectionKey,
    sectionOrder: args.order,
    sectionRowHash: args.signed?.section.rowHash,
    sourceRevision: "2026",
    timeLimitSeconds: 1800,
    ...(args.tryoutSectionId ? { tryoutSectionId: args.tryoutSectionId } : {}),
  };
}

/** Inserts one attempt from immutable section snapshots. */
export async function insertTryoutAttempt(
  ctx: MutationCtx,
  args: {
    expiresAt?: number;
    scaleVersionId?: Id<"irtScaleVersions">;
    scoringStrategy?: Doc<"tryoutAttempts">["scoringStrategy"];
    sectionSnapshots: Doc<"tryoutAttempts">["sectionSnapshots"];
    setPublicPath?: string;
    status?: Doc<"tryoutAttempts">["status"];
    tryoutSetId: Id<"tryoutSets">;
    userId: Id<"users">;
  }
) {
  const scoringStrategy = args.scoringStrategy ?? "irt";
  const accessEndsAt = args.expiresAt ?? TRYOUT_TEST_NOW + 86_400_000;

  return await ctx.db.insert("tryoutAttempts", {
    accessEndsAt,
    accessSourceKind: "free",
    attemptNumber: 1,
    completedAt: null,
    completedSectionKeys: [],
    endReason: null,
    countsForCompetition: false,
    expiresAt: accessEndsAt,
    lastActivityAt: TRYOUT_TEST_NOW - 10_000,
    scaleVersionId: args.scaleVersionId,
    scoreStatus: scoringStrategy === "irt" ? "provisional" : "official",
    scoringStrategy,
    sectionSnapshots: args.sectionSnapshots,
    setPublicPath: args.setPublicPath,
    startedAt: TRYOUT_TEST_NOW - 20_000,
    status: args.status ?? "in-progress",
    totalCorrect: 0,
    totalQuestions: args.sectionSnapshots.reduce(
      (total, section) => total + section.questionCount,
      0
    ),
    tryoutSetId: args.tryoutSetId,
    userId: args.userId,
  });
}

/** Inserts the active section row used while testing attempt finalization. */
export async function insertTryoutSectionAttempt(
  ctx: MutationCtx,
  args: {
    expiresAt?: number;
    sectionKey?: string;
    sectionOrder?: number;
    totalQuestions?: number;
    tryoutAttemptId: Id<"tryoutAttempts">;
    tryoutSectionId: Id<"tryoutSections">;
  }
) {
  return await ctx.db.insert("tryoutSectionAttempts", {
    answeredCount: 0,
    completedAt: null,
    correctAnswers: 0,
    endReason: null,
    expiresAt: args.expiresAt ?? TRYOUT_TEST_NOW + 1_800_000,
    lastActivityAt: TRYOUT_TEST_NOW - 10_000,
    sectionKey: args.sectionKey ?? TRYOUT_SECTION_KEY,
    sectionOrder: args.sectionOrder ?? 1,
    startedAt: TRYOUT_TEST_NOW - 20_000,
    status: "in-progress",
    totalQuestions: args.totalQuestions ?? 1,
    tryoutAttemptId: args.tryoutAttemptId,
    tryoutSectionId: args.tryoutSectionId,
  });
}

/** Inserts the calibrated item required to score one IRT placement. */
export async function insertIrtScaleItem(
  ctx: MutationCtx,
  args: {
    placement: AlignedTryoutSectionFixture["signed"]["placements"][number];
    questionId: Id<"questions">;
    scaleVersionId: Id<"irtScaleVersions">;
    sectionId: Id<"tryoutSections">;
  }
) {
  const question = await ctx.db.get(args.questionId);
  if (!question) {
    throw new ConvexError({
      code: "TRYOUT_QUESTION_NOT_FOUND",
      message: "Expected the calibrated question fixture.",
    });
  }

  const calibrationRunId = await ctx.db.insert("irtCalibrationRuns", {
    attemptCount: 0,
    completedAt: TRYOUT_TEST_NOW,
    iterationCount: 0,
    maxParameterDelta: 0,
    model: "2pl",
    questionCount: 1,
    responseCount: 0,
    startedAt: TRYOUT_TEST_NOW,
    status: "completed",
    tryoutSectionId: args.sectionId,
    updatedAt: TRYOUT_TEST_NOW,
  });

  await ctx.db.insert("irtScaleItems", {
    calibrationRunId,
    calibrationStatus: "provisional",
    contentHash: question.contentHash,
    correctRate: 0,
    difficulty: 0,
    discrimination: 1,
    placementIdentity: tryoutPlacementIdentity(args.placement.row),
    placementRowHash: args.placement.rowHash,
    questionId: args.questionId,
    questionSourceKey: question.sourceKey,
    responseCount: 0,
    scaleVersionId: args.scaleVersionId,
    sourceRevision: "2026",
  });
}
