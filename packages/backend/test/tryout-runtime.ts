import type { ContentLocale } from "@nakafa/aksara-contracts/content";
import {
  tryoutCatalogIdentity,
  tryoutPlacementIdentity,
} from "@nakafa/aksara-contracts/tryout/identity";
import type { TryoutSet } from "@nakafa/aksara-contracts/tryout/spec";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import type {
  TryoutCurrentAnswerSelector,
  TryoutCurrentQuestionSelector,
} from "@repo/backend/convex/tryouts/runtime/content";
import type { TryoutStatus } from "@repo/backend/convex/tryouts/status";
import {
  TEST_RELEASE_ID,
  testTextHash,
} from "@repo/backend/test/content-release";
import {
  makeSignedTryoutSection,
  makeSignedTryoutSource,
  type SignedTryoutSectionFixture,
} from "@repo/backend/test/tryout-section";
import { activateTryoutSnapshot } from "@repo/backend/test/tryout-snapshot";
import {
  makeTryoutSection,
  makeTryoutSet,
  TRYOUT_SECTION_KEY,
  TRYOUT_SECTION_PATH,
  TRYOUT_TEST_NOW,
} from "@repo/backend/test/tryouts";

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
    suffix: string;
  }
) {
  const identity = await seedAuthenticatedUser(ctx, {
    now: TRYOUT_TEST_NOW,
    suffix: args.suffix,
  });
  const set = makeTryoutSet();
  const section = makeTryoutSection({
    publicPath: TRYOUT_SECTION_PATH,
  });
  const attemptTerminal = args.attemptStatus !== "in-progress";
  const sectionTerminal = args.sectionStatus !== "in-progress";
  const fixtureLocale: ContentLocale = "id";
  const signedSection = makeSignedTryoutSection(section);
  const signedSource = makeSignedTryoutSource(set, [signedSection]);
  const signedPlacement = signedSection.signed.placements[0];
  if (!signedPlacement) {
    throw new Error("Expected one signed try-out placement fixture.");
  }
  const snapshotId = await activateTryoutSnapshot(ctx, {
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
  });
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
    sectionSnapshots: [
      tryoutSectionSnapshot({
        signed: signedSection.signed,
      }),
    ],
    startedAt: TRYOUT_TEST_NOW,
    status: args.attemptStatus,
    totalCorrect: 0,
    totalQuestions: 1,
    userId: identity.userId,
    countryKey: "indonesia",
    examKey: "snbt",
    locale: fixtureLocale,
    setIdentity,
    setKey: "set-1",
    setPublicPath: signedSource.snapshot.set.row.publicPath,
    snapshotReleaseId: TEST_RELEASE_ID,
    trackKey: "2027",
    tryoutSnapshotId: snapshotId,
  });

  const sectionAttemptId = await ctx.db.insert("tryoutSectionAttempts", {
    answeredCount: 0,
    completedAt: sectionTerminal ? TRYOUT_TEST_NOW : null,
    correctAnswers: 0,
    endReason: getEndReason(args.sectionStatus),
    expiresAt: TRYOUT_TEST_NOW + 1_800_000,
    lastActivityAt: TRYOUT_TEST_NOW,
    sectionKey: TRYOUT_SECTION_KEY,
    sectionIdentity: tryoutCatalogIdentity(signedSection.signed.section.row),
    sectionOrder: 1,
    startedAt: TRYOUT_TEST_NOW,
    status: args.sectionStatus,
    totalQuestions: 1,
    tryoutAttemptId: attemptId,
  });

  const { row: placementRow, rowHash: placementRowHash } = signedPlacement;
  const placementId = await ctx.db.insert("tryoutAttemptPlacements", {
    answerArtifactHash: placementRow.answerArtifactHash,
    answerContentKey: placementRow.answerContentKey,
    choiceSnapshots: [...placementRow.choices],
    contentHash: placementRow.contentHash,
    placementIdentity: tryoutPlacementIdentity(placementRow),
    placementRowHash,
    questionArtifactHash: placementRow.questionArtifactHash,
    questionContentKey: placementRow.questionContentKey,
    questionOrder: placementRow.questionOrder,
    rendererDomain: placementRow.rendererDomain,
    sectionIdentity: tryoutCatalogIdentity(signedSection.signed.section.row),
    sectionKey: placementRow.sectionKey,
    sourcePath: placementRow.questionSourcePath,
    sourceRevision: placementRow.sourceRevision,
    title: placementRow.title,
    tryoutAttemptId: attemptId,
  });

  const answer: TryoutCurrentAnswerSelector = {
    artifactHash: placementRow.answerArtifactHash,
    contentHash: placementRow.contentHash,
    contentKey: placementRow.answerContentKey,
    delivery: "entitled",
    locale: fixtureLocale,
    questionOrder: placementRow.questionOrder,
    snapshotId,
    snapshotReleaseId: TEST_RELEASE_ID,
    sourcePath: placementRow.questionSourcePath,
    sourceRevision: placementRow.sourceRevision,
  };
  const question: TryoutCurrentQuestionSelector = {
    artifactHash: placementRow.questionArtifactHash,
    contentHash: placementRow.contentHash,
    contentKey: placementRow.questionContentKey,
    delivery: "authenticated",
    locale: fixtureLocale,
    questionOrder: placementRow.questionOrder,
    snapshotId,
    snapshotReleaseId: TEST_RELEASE_ID,
    sourcePath: placementRow.questionSourcePath,
    sourceRevision: placementRow.sourceRevision,
  };

  return {
    attemptId,
    identity,
    placementId,
    sectionAttemptId,
    signedContent: { answer, question },
  };
}

/** Builds the immutable section shape stored on an attempt. */
export function tryoutSectionSnapshot(args: {
  signed: SignedTryoutSectionFixture["signed"];
}) {
  const { row, rowHash } = args.signed.section;

  return {
    publicPath: row.publicPath,
    questionCount: row.questionCount,
    questionSourcePath: row.questionSourcePath,
    sectionIdentity: tryoutCatalogIdentity(row),
    sectionKey: row.sectionKey,
    sectionOrder: row.order,
    sectionRowHash: rowHash,
    sourceRevision: row.sourceRevision,
    timeLimitSeconds: row.timeLimitSeconds,
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
    set: TryoutSet;
    snapshotId?: Doc<"tryoutAttempts">["tryoutSnapshotId"];
    snapshotReleaseId?: Doc<"tryoutAttempts">["snapshotReleaseId"];
    status?: Doc<"tryoutAttempts">["status"];
    userId: Id<"users">;
  }
) {
  const scoringStrategy = args.scoringStrategy ?? "irt";
  const accessEndsAt = args.expiresAt ?? TRYOUT_TEST_NOW + 86_400_000;
  const setIdentity = tryoutCatalogIdentity(args.set);

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
    setPublicPath: args.set.publicPath,
    startedAt: TRYOUT_TEST_NOW - 20_000,
    status: args.status ?? "in-progress",
    totalCorrect: 0,
    totalQuestions: args.sectionSnapshots.reduce(
      (total, section) => total + section.questionCount,
      0
    ),
    userId: args.userId,
    countryKey: args.set.countryKey,
    examKey: args.set.examKey,
    locale: args.set.locale,
    setIdentity,
    setKey: args.set.setKey,
    snapshotReleaseId: args.snapshotReleaseId ?? TEST_RELEASE_ID,
    trackKey: args.set.trackKey,
    tryoutSnapshotId:
      args.snapshotId ?? testTextHash("tryout-runtime-snapshot"),
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
    sectionIdentity: tryoutCatalogIdentity({
      countryKey: "indonesia",
      examKey: "snbt",
      kind: "section",
      locale: "id",
      sectionKey: args.sectionKey ?? TRYOUT_SECTION_KEY,
      setKey: "set-1",
      trackKey: "2027",
    }),
    sectionOrder: args.sectionOrder ?? 1,
    startedAt: TRYOUT_TEST_NOW - 20_000,
    status: "in-progress",
    totalQuestions: args.totalQuestions ?? 1,
    tryoutAttemptId: args.tryoutAttemptId,
  });
}

/** Copies one immutable placement fixture onto another attempt. */
export function insertTryoutAttemptPlacement(
  ctx: MutationCtx,
  args: {
    placement: Doc<"tryoutAttemptPlacements">;
    tryoutAttemptId: Id<"tryoutAttempts">;
  }
) {
  const { placement } = args;

  return ctx.db.insert("tryoutAttemptPlacements", {
    answerArtifactHash: placement.answerArtifactHash,
    answerContentKey: placement.answerContentKey,
    choiceSnapshots: placement.choiceSnapshots,
    contentHash: placement.contentHash,
    placementIdentity: placement.placementIdentity,
    placementRowHash: placement.placementRowHash,
    questionArtifactHash: placement.questionArtifactHash,
    questionContentKey: placement.questionContentKey,
    questionOrder: placement.questionOrder,
    rendererDomain: placement.rendererDomain,
    sectionIdentity: placement.sectionIdentity,
    sectionKey: placement.sectionKey,
    sourcePath: placement.sourcePath,
    sourceRevision: placement.sourceRevision,
    title: placement.title,
    tryoutAttemptId: args.tryoutAttemptId,
  });
}

/** Inserts the calibrated item required to score one IRT placement. */
export async function insertIrtScaleItem(
  ctx: MutationCtx,
  args: {
    placement: SignedTryoutSectionFixture["signed"]["placements"][number];
    scaleVersionId: Id<"irtScaleVersions">;
  }
) {
  const sectionIdentity = tryoutCatalogIdentity({
    countryKey: args.placement.row.countryKey,
    examKey: args.placement.row.examKey,
    kind: "section",
    locale: args.placement.row.locale,
    sectionKey: args.placement.row.sectionKey,
    setKey: args.placement.row.setKey,
    trackKey: args.placement.row.trackKey,
  });
  const existingRuns = await ctx.db
    .query("irtCalibrationRuns")
    .withIndex("by_scaleVersionId_and_sectionIdentity_and_startedAt", (query) =>
      query
        .eq("scaleVersionId", args.scaleVersionId)
        .eq("sectionIdentity", sectionIdentity)
    )
    .take(2);
  if (existingRuns.length > 1) {
    throw new Error("Expected at most one IRT calibration run fixture.");
  }

  const existingRun = existingRuns[0];
  const calibrationRunId = existingRun
    ? existingRun._id
    : await ctx.db.insert("irtCalibrationRuns", {
        attemptCount: 0,
        completedAt: TRYOUT_TEST_NOW,
        iterationCount: 0,
        maxParameterDelta: 0,
        model: "2pl",
        questionCount: 0,
        responseCount: 0,
        scaleVersionId: args.scaleVersionId,
        sectionIdentity,
        startedAt: TRYOUT_TEST_NOW,
        status: "completed",
        updatedAt: TRYOUT_TEST_NOW,
      });
  const questionCount = (existingRun?.questionCount ?? 0) + 1;
  await ctx.db.patch(calibrationRunId, { questionCount });

  return await ctx.db.insert("irtScaleItems", {
    calibrationRunId,
    calibrationStatus: "provisional",
    correctRate: 0,
    difficulty: 0,
    discrimination: 1,
    placementIdentity: tryoutPlacementIdentity(args.placement.row),
    placementRowHash: args.placement.rowHash,
    responseCount: 0,
    scaleVersionId: args.scaleVersionId,
  });
}
