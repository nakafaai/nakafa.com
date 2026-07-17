import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  TRYOUT_SECTION_KEY,
  TRYOUT_TEST_NOW,
} from "@repo/backend/test/tryouts";

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
    status?: Doc<"tryoutAttempts">["status"];
    tryoutSetId: Id<"tryoutSets">;
    userId: Id<"users">;
  }
) {
  const scoringStrategy = args.scoringStrategy ?? "irt";

  return await ctx.db.insert("tryoutAttempts", {
    attemptNumber: 1,
    completedAt: null,
    completedSectionKeys: [],
    endReason: null,
    expiresAt: args.expiresAt ?? TRYOUT_TEST_NOW + 86_400_000,
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
