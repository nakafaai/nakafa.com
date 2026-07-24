import { tryoutCatalogIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import type { TryoutStatus } from "@repo/backend/convex/tryouts/schema";
import {
  insertTryoutQuestionSource,
  insertTryoutSection,
  insertTryoutSet,
  TRYOUT_SECTION_KEY,
  TRYOUT_TEST_NOW,
} from "@repo/backend/test/tryouts";

/** Replaces one catalog row while preserving its stable source identity. */
export async function replaceTryoutSet(
  ctx: MutationCtx,
  tryoutSetId: Id<"tryoutSets">
) {
  const set = await ctx.db.get(tryoutSetId);
  if (!set) {
    throw new Error("Expected one try-out set before catalog replacement.");
  }
  const sections = await ctx.db
    .query("tryoutSections")
    .withIndex("by_tryoutSetId_and_order", (query) =>
      query.eq("tryoutSetId", tryoutSetId)
    )
    .take(101);
  if (sections.length > 100) {
    throw new Error("Catalog replacement fixture exceeded 100 sections.");
  }
  const { _creationTime: _creation, _id, ...fields } = set;
  await ctx.db.delete(_id);
  const replacementId = await ctx.db.insert("tryoutSets", fields);
  for (const section of sections) {
    await ctx.db.patch(section._id, { tryoutSetId: replacementId });
  }
  return replacementId;
}

/** Returns the coherent terminal reason for one fixture status. */
function getEndReason(status: TryoutStatus) {
  if (status === "in-progress") {
    return null;
  }

  if (status === "expired") {
    return "time-expired" as const;
  }

  return "submitted" as const;
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
  const tryoutSetId = await insertTryoutSet(ctx);
  const stableSet = await loadStableSetFields(ctx, tryoutSetId);
  const questionSetId = await insertTryoutQuestionSource(ctx);
  const tryoutSectionId = await insertTryoutSection(ctx, {
    questionSetId,
    tryoutSetId,
  });
  const attemptTerminal = args.attemptStatus !== "in-progress";
  const sectionTerminal = args.sectionStatus !== "in-progress";
  const attemptId = await ctx.db.insert("tryoutAttempts", {
    ...stableSet,
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
    tryoutSnapshotId: "snapshot:tryout:runtime",
    userId: identity.userId,
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

  return { identity, sectionAttemptId };
}

/** Builds the immutable section shape stored on an attempt. */
export function tryoutSectionSnapshot(args: {
  order: number;
  publicPath: string;
  questionSetId: Id<"questionSets">;
  sectionKey: string;
  sourcePath: string;
  tryoutSectionId: Id<"tryoutSections">;
}) {
  return {
    publicPath: args.publicPath,
    questionCount: 1,
    questionSetId: args.questionSetId,
    questionSourcePath: args.sourcePath,
    sectionKey: args.sectionKey,
    sectionOrder: args.order,
    sourceRevision: "2026",
    timeLimitSeconds: 1800,
    tryoutSectionId: args.tryoutSectionId,
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
    snapshotId?: string;
    status?: Doc<"tryoutAttempts">["status"];
    tryoutSetId: Id<"tryoutSets">;
    userId: Id<"users">;
  }
) {
  const scoringStrategy = args.scoringStrategy ?? "irt";
  const accessEndsAt = args.expiresAt ?? TRYOUT_TEST_NOW + 86_400_000;
  const stableSet = await loadStableSetFields(ctx, args.tryoutSetId);

  return await ctx.db.insert("tryoutAttempts", {
    ...stableSet,
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
    startedAt: TRYOUT_TEST_NOW - 20_000,
    status: args.status ?? "in-progress",
    totalCorrect: 0,
    totalQuestions: args.sectionSnapshots.reduce(
      (total, section) => total + section.questionCount,
      0
    ),
    tryoutSetId: args.tryoutSetId,
    tryoutSnapshotId: args.snapshotId ?? "snapshot:tryout:runtime",
    userId: args.userId,
  });
}

/** Loads the exact set identity copied into one post-migration attempt. */
async function loadStableSetFields(
  ctx: MutationCtx,
  tryoutSetId: Id<"tryoutSets">
) {
  const set = await ctx.db.get(tryoutSetId);
  if (!set) {
    throw new Error("Expected one try-out set for the runtime attempt.");
  }
  return {
    countryKey: set.countryKey,
    examKey: set.examKey,
    locale: set.locale,
    setIdentity: tryoutCatalogIdentity({ ...set, kind: "set" }),
    setKey: set.setKey,
    trackKey: set.trackKey,
  };
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
    questionId: Id<"questions">;
    scaleVersionId: Id<"irtScaleVersions">;
    sectionId: Id<"tryoutSections">;
    sourcePath: string;
  }
) {
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
    contentHash: `${args.sourcePath}:question-hash`,
    correctRate: 0,
    difficulty: 0,
    discrimination: 1,
    questionId: args.questionId,
    questionSourceKey: `${args.sourcePath}:question-1`,
    responseCount: 0,
    scaleVersionId: args.scaleVersionId,
    sourceRevision: "2026",
  });
}
