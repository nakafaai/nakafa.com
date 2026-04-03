import { register as registerAggregate } from "@convex-dev/aggregate/test";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";

export const NOW = Date.UTC(2026, 3, 3, 9, 0, 0);
export const ATTEMPT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/** Builds the Convex test instance used by tryout backend tests. */
export function createTryoutTestConvex() {
  const t = createConvexTestWithBetterAuth();

  registerAggregate(t, "globalLeaderboard");
  registerAggregate(t, "tryoutLeaderboard");

  return t;
}

/** Inserts the smallest valid tryout shell plus one published frozen scale. */
export async function insertTryoutSkeleton(
  ctx: MutationCtx,
  slug: string,
  questionCount = 20
) {
  const setId = await ctx.db.insert("exerciseSets", {
    locale: "id",
    slug: `exercises/high-school/snbt/quantitative-knowledge/try-out/2026/${slug}`,
    category: "high-school",
    type: "snbt",
    material: "quantitative-knowledge",
    exerciseType: "try-out",
    setName: slug,
    title: `Set ${slug}`,
    questionCount,
    syncedAt: NOW,
  });
  const tryoutId = await ctx.db.insert("tryouts", {
    product: "snbt",
    locale: "id",
    cycleKey: "2026",
    slug,
    label: `Tryout ${slug}`,
    partCount: 1,
    totalQuestionCount: questionCount,
    isActive: true,
    detectedAt: NOW,
    syncedAt: NOW,
  });

  await ctx.db.insert("tryoutPartSets", {
    tryoutId,
    setId,
    partIndex: 0,
    partKey: "quantitative-knowledge",
  });

  const scaleVersionId = await ctx.db.insert("irtScaleVersions", {
    tryoutId,
    model: "2pl",
    status: "official",
    questionCount,
    publishedAt: NOW,
  });

  return {
    scaleVersionId,
    setId,
    tryoutId,
  };
}

/** Inserts a single exercise question row for one seeded tryout set. */
export async function insertExerciseQuestion(
  ctx: MutationCtx,
  setId: Id<"exerciseSets">,
  {
    material = "quantitative-knowledge",
    slug,
  }: {
    material?: Doc<"exerciseQuestions">["material"];
    slug: string;
  }
) {
  return await ctx.db.insert("exerciseQuestions", {
    setId,
    locale: "id",
    slug: `exercises/high-school/snbt/${material}/try-out/2026/${slug}/1`,
    category: "high-school",
    type: "snbt",
    material,
    exerciseType: "try-out",
    setName: slug,
    number: 1,
    title: `Question ${slug}`,
    date: NOW,
    questionBody: "Question body",
    answerBody: "Answer body",
    contentHash: `hash-${slug}`,
    syncedAt: NOW,
  });
}

/** Seeds one completed single-part tryout attempt and its latest-attempt pointer. */
export async function insertCompletedTryoutAttempt(
  ctx: MutationCtx,
  {
    scaleVersionId,
    setId,
    slug,
    tryoutId,
    userId,
  }: {
    scaleVersionId: Id<"irtScaleVersions">;
    setId: Id<"exerciseSets">;
    slug: string;
    tryoutId: Id<"tryouts">;
    userId: Id<"users">;
  }
) {
  const setAttemptId = await ctx.db.insert("exerciseAttempts", {
    slug: `exercises/high-school/snbt/quantitative-knowledge/try-out/2026/${slug}`,
    userId,
    origin: "tryout",
    mode: "simulation",
    scope: "set",
    timeLimit: 1800,
    startedAt: NOW,
    lastActivityAt: NOW,
    completedAt: NOW,
    endReason: "submitted",
    status: "completed",
    updatedAt: NOW,
    totalExercises: 20,
    answeredCount: 20,
    correctAnswers: 0,
    totalTime: 1800,
    scorePercentage: 0,
  });
  const tryoutAttemptId = await ctx.db.insert("tryoutAttempts", {
    userId,
    tryoutId,
    scaleVersionId,
    scoreStatus: "official",
    status: "completed",
    partSetSnapshots: [
      {
        partIndex: 0,
        partKey: "quantitative-knowledge",
        questionCount: 20,
        setId,
      },
    ],
    completedPartIndices: [0],
    totalCorrect: 0,
    totalQuestions: 20,
    theta: 0,
    thetaSE: 1,
    startedAt: NOW,
    expiresAt: NOW + ATTEMPT_WINDOW_MS,
    lastActivityAt: NOW,
    completedAt: NOW,
    endReason: "submitted",
  });

  await ctx.db.insert("tryoutPartAttempts", {
    tryoutAttemptId,
    partIndex: 0,
    partKey: "quantitative-knowledge",
    setAttemptId,
    setId,
    theta: 0,
    thetaSE: 1,
  });
  await ctx.db.insert("userTryoutLatestAttempts", {
    userId,
    product: "snbt",
    locale: "id",
    tryoutId,
    attemptId: tryoutAttemptId,
    slug,
    status: "completed",
    expiresAtMs: NOW + ATTEMPT_WINDOW_MS,
    updatedAt: NOW,
  });

  return {
    setAttemptId,
    tryoutAttemptId,
  };
}

/** Seeds one expired tryout where a later part was never started. */
export async function seedExpiredTryoutWithUntouchedPart(
  ctx: MutationCtx,
  suffix: string
) {
  const identity = await seedAuthenticatedUser(ctx, {
    now: NOW,
    suffix,
  });
  const firstSetId = await ctx.db.insert("exerciseSets", {
    locale: "id",
    slug: `exercises/high-school/snbt/quantitative-knowledge/try-out/2026/${suffix}-qk`,
    category: "high-school",
    type: "snbt",
    material: "quantitative-knowledge",
    exerciseType: "try-out",
    setName: `${suffix}-qk`,
    title: "Quantitative Knowledge",
    questionCount: 1,
    syncedAt: NOW,
  });
  const secondSetId = await ctx.db.insert("exerciseSets", {
    locale: "id",
    slug: `exercises/high-school/snbt/mathematical-reasoning/try-out/2026/${suffix}-mr`,
    category: "high-school",
    type: "snbt",
    material: "mathematical-reasoning",
    exerciseType: "try-out",
    setName: `${suffix}-mr`,
    title: "Mathematical Reasoning",
    questionCount: 1,
    syncedAt: NOW,
  });
  const tryoutId = await ctx.db.insert("tryouts", {
    product: "snbt",
    locale: "id",
    cycleKey: "2026",
    slug: suffix,
    label: `Tryout ${suffix}`,
    partCount: 2,
    totalQuestionCount: 2,
    isActive: true,
    detectedAt: NOW,
    syncedAt: NOW,
  });

  await ctx.db.insert("tryoutPartSets", {
    tryoutId,
    setId: firstSetId,
    partIndex: 0,
    partKey: "quantitative-knowledge",
  });
  await ctx.db.insert("tryoutPartSets", {
    tryoutId,
    setId: secondSetId,
    partIndex: 1,
    partKey: "mathematical-reasoning",
  });

  const scaleVersionId = await ctx.db.insert("irtScaleVersions", {
    tryoutId,
    model: "2pl",
    status: "provisional",
    questionCount: 2,
    publishedAt: NOW,
  });
  const firstQuestionId = await insertExerciseQuestion(ctx, firstSetId, {
    slug: `${suffix}-qk`,
  });
  const secondQuestionId = await insertExerciseQuestion(ctx, secondSetId, {
    material: "mathematical-reasoning",
    slug: `${suffix}-mr`,
  });
  const firstRunId = await ctx.db.insert("irtCalibrationRuns", {
    setId: firstSetId,
    model: "2pl",
    status: "completed",
    questionCount: 1,
    responseCount: 200,
    attemptCount: 200,
    iterationCount: 1,
    maxParameterDelta: 0.001,
    startedAt: NOW,
    updatedAt: NOW,
    completedAt: NOW,
  });
  const secondRunId = await ctx.db.insert("irtCalibrationRuns", {
    setId: secondSetId,
    model: "2pl",
    status: "completed",
    questionCount: 1,
    responseCount: 200,
    attemptCount: 200,
    iterationCount: 1,
    maxParameterDelta: 0.001,
    startedAt: NOW,
    updatedAt: NOW,
    completedAt: NOW,
  });

  await ctx.db.insert("irtScaleVersionItems", {
    scaleVersionId,
    calibrationRunId: firstRunId,
    questionId: firstQuestionId,
    setId: firstSetId,
    difficulty: 0,
    discrimination: 1,
  });
  await ctx.db.insert("irtScaleVersionItems", {
    scaleVersionId,
    calibrationRunId: secondRunId,
    questionId: secondQuestionId,
    setId: secondSetId,
    difficulty: 0,
    discrimination: 1,
  });

  const setAttemptId = await ctx.db.insert("exerciseAttempts", {
    slug: `exercises/high-school/snbt/quantitative-knowledge/try-out/2026/${suffix}-qk`,
    userId: identity.userId,
    origin: "tryout",
    mode: "simulation",
    scope: "set",
    timeLimit: 90,
    startedAt: NOW,
    lastActivityAt: NOW,
    completedAt: NOW,
    endReason: "time-expired",
    status: "expired",
    updatedAt: NOW,
    totalExercises: 1,
    answeredCount: 0,
    correctAnswers: 0,
    totalTime: 90,
    scorePercentage: 0,
  });
  const tryoutAttemptId = await ctx.db.insert("tryoutAttempts", {
    userId: identity.userId,
    tryoutId,
    scaleVersionId,
    scoreStatus: "provisional",
    status: "expired",
    partSetSnapshots: [
      {
        partIndex: 0,
        partKey: "quantitative-knowledge",
        questionCount: 1,
        setId: firstSetId,
      },
      {
        partIndex: 1,
        partKey: "mathematical-reasoning",
        questionCount: 1,
        setId: secondSetId,
      },
    ],
    completedPartIndices: [0],
    totalCorrect: 0,
    totalQuestions: 1,
    theta: 0,
    thetaSE: 1,
    startedAt: NOW,
    expiresAt: NOW + ATTEMPT_WINDOW_MS,
    lastActivityAt: NOW,
    completedAt: NOW,
    endReason: "time-expired",
  });

  await ctx.db.insert("tryoutPartAttempts", {
    tryoutAttemptId,
    partIndex: 0,
    partKey: "quantitative-knowledge",
    setAttemptId,
    setId: firstSetId,
    theta: 0,
    thetaSE: 1,
  });
  await ctx.db.insert("userTryoutLatestAttempts", {
    userId: identity.userId,
    product: "snbt",
    locale: "id",
    tryoutId,
    attemptId: tryoutAttemptId,
    slug: suffix,
    status: "expired",
    expiresAtMs: NOW + ATTEMPT_WINDOW_MS,
    updatedAt: NOW,
  });

  return {
    identity,
    tryoutSlug: suffix,
  };
}
