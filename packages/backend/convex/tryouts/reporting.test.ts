import { register as registerAggregate } from "@convex-dev/aggregate/test";
import { api, components, internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import authSchema from "@repo/backend/convex/betterAuth/schema";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { tryoutLeaderboard } from "@repo/backend/convex/tryouts/aggregate";
import { syncTryoutAttemptAggregates } from "@repo/backend/convex/tryouts/helpers/finalize/aggregates";
import { finalizeTryoutAttempt } from "@repo/backend/convex/tryouts/helpers/finalize/attempt";
import { buildFinalizedTryoutSnapshot } from "@repo/backend/convex/tryouts/helpers/finalize/snapshot";
import { snbtTryoutProductPolicy } from "@repo/backend/convex/tryouts/products/snbt";
import { products } from "@repo/backend/convex/utils/polar/products";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

const betterAuthModules = import.meta.glob(["../betterAuth/**/*.ts"]);
const NOW = Date.UTC(2026, 3, 3, 9, 0, 0);
const ATTEMPT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/** Creates one Convex test instance with the components these tests depend on. */
function createTestConvex() {
  const t = convexTest(schema, convexModules);
  registerAggregate(t, "globalLeaderboard");
  t.registerComponent("betterAuth", authSchema, betterAuthModules);
  registerAggregate(t, "tryoutLeaderboard");
  return t;
}

/** Seeds one authenticated Better Auth user plus the matching app user row. */
async function seedAuthenticatedUser(ctx: MutationCtx, suffix: string) {
  const authUser = (await ctx.runMutation(
    components.betterAuth.adapter.create,
    {
      input: {
        model: "user",
        data: {
          createdAt: NOW,
          email: `${suffix}@example.com`,
          emailVerified: true,
          name: `User ${suffix}`,
          updatedAt: NOW,
        },
      },
      select: ["_id", "email", "name"],
    }
  )) as { _id: string; email: string; name: string };
  const session = (await ctx.runMutation(components.betterAuth.adapter.create, {
    input: {
      model: "session",
      data: {
        createdAt: NOW,
        expiresAt: NOW + ATTEMPT_WINDOW_MS,
        token: `session-${suffix}`,
        updatedAt: NOW,
        userId: authUser._id,
      },
    },
    select: ["_id"],
  })) as { _id: string };
  const userId = await ctx.db.insert("users", {
    authId: authUser._id,
    email: authUser.email,
    name: authUser.name,
    plan: "free",
    credits: 10,
    creditsResetAt: NOW,
  });

  return {
    authUserId: authUser._id,
    sessionId: session._id,
    userId,
  };
}

/** Inserts the smallest valid tryout shell plus one published frozen scale. */
async function insertTryoutSkeleton(
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

/** Inserts one exercise question row for a test set. */
async function insertExerciseQuestion(
  ctx: MutationCtx,
  setId: Id<"exerciseSets">,
  slug: string
) {
  return await ctx.db.insert("exerciseQuestions", {
    setId,
    locale: "id",
    slug: `exercises/high-school/snbt/quantitative-knowledge/try-out/2026/${slug}/1`,
    category: "high-school",
    type: "snbt",
    material: "quantitative-knowledge",
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

/** Grants the test user active Pro access through customer/subscription rows. */
async function grantProAccess(
  ctx: MutationCtx,
  userId: Id<"users">,
  suffix: string
) {
  await ctx.db.insert("customers", {
    id: `customer-${suffix}`,
    externalId: null,
    metadata: {},
    userId,
  });

  await ctx.db.insert("subscriptions", {
    id: `subscription-${suffix}`,
    customerId: `customer-${suffix}`,
    createdAt: new Date(NOW).toISOString(),
    modifiedAt: null,
    amount: null,
    currency: null,
    recurringInterval: null,
    status: "active",
    currentPeriodStart: new Date(NOW).toISOString(),
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    startedAt: new Date(NOW).toISOString(),
    endedAt: null,
    productId: products.pro.id,
    checkoutId: null,
    metadata: {},
  });
}

/** Inserts one completed tryout attempt with a single completed part. */
async function insertCompletedTryoutAttempt(
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

/** Inserts one completed one-question tryout attempt for aggregate sync tests. */
async function insertSingleQuestionCompletedAttempt(
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
  const questionId = await insertExerciseQuestion(ctx, setId, slug);
  const setAttemptId = await ctx.db.insert("exerciseAttempts", {
    slug: `exercises/high-school/snbt/quantitative-knowledge/try-out/2026/${slug}`,
    userId,
    origin: "tryout",
    mode: "simulation",
    scope: "set",
    timeLimit: 90,
    startedAt: NOW,
    lastActivityAt: NOW,
    completedAt: NOW,
    endReason: "submitted",
    status: "completed",
    updatedAt: NOW,
    totalExercises: 1,
    answeredCount: 1,
    correctAnswers: 0,
    totalTime: 90,
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
        questionCount: 1,
        setId,
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
    endReason: "submitted",
  });

  await ctx.db.insert("exerciseAnswers", {
    attemptId: setAttemptId,
    exerciseNumber: 1,
    questionId,
    isCorrect: false,
    timeSpent: 90,
    answeredAt: NOW,
    updatedAt: NOW,
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
  await ctx.db.insert("irtScaleVersionItems", {
    scaleVersionId,
    calibrationRunId: await ctx.db.insert("irtCalibrationRuns", {
      setId,
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
    }),
    questionId,
    setId,
    difficulty: 0,
    discrimination: 1,
  });

  return { tryoutAttemptId };
}

describe("tryouts/reporting", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps theta onto the public 0-1000 report scale", () => {
    expect(snbtTryoutProductPolicy.scaleThetaToScore(-4)).toBe(0);
    expect(snbtTryoutProductPolicy.scaleThetaToScore(0)).toBe(500);
    expect(snbtTryoutProductPolicy.scaleThetaToScore(4)).toBe(1000);
    expect(snbtTryoutProductPolicy.scaleThetaToScore(-99)).toBe(0);
    expect(snbtTryoutProductPolicy.scaleThetaToScore(99)).toBe(1000);
  });

  it("starts new tryout attempts without persisting a legacy irtScore field", async () => {
    const t = createTestConvex();
    const identity = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, "start-reporting");
      const tryout = await insertTryoutSkeleton(ctx, "2026-reporting-start");

      await grantProAccess(ctx, identity.userId, "start-reporting");

      return {
        ...identity,
        tryoutId: tryout.tryoutId,
      };
    });

    await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .mutation(api.tryouts.mutations.attempts.startTryout, {
        product: "snbt",
        locale: "id",
        tryoutSlug: "2026-reporting-start",
      });

    const tryoutAttempt = await t.query(async (ctx) => {
      return await ctx.db
        .query("tryoutAttempts")
        .withIndex("by_userId_and_tryoutId_and_startedAt", (q) =>
          q.eq("userId", identity.userId).eq("tryoutId", identity.tryoutId)
        )
        .order("desc")
        .first();
    });

    expect(tryoutAttempt).not.toBeNull();
    expect(tryoutAttempt?.theta).toBe(0);

    if (!tryoutAttempt) {
      return;
    }

    expect("irtScore" in tryoutAttempt).toBe(false);
    expect(tryoutAttempt.partSetSnapshots).toEqual([
      {
        partIndex: 0,
        partKey: "quantitative-knowledge",
        questionCount: 20,
        setId: expect.any(String),
      },
    ]);
  });

  it("derives the latest tryout score from theta instead of a stored legacy score", async () => {
    const t = createTestConvex();
    const identity = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, "attempt-reporting");
      const tryout = await insertTryoutSkeleton(ctx, "2026-reporting-attempt");

      await insertCompletedTryoutAttempt(ctx, {
        scaleVersionId: tryout.scaleVersionId,
        setId: tryout.setId,
        slug: "2026-reporting-attempt",
        tryoutId: tryout.tryoutId,
        userId: identity.userId,
      });

      return identity;
    });

    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .query(api.tryouts.queries.me.attempt.getUserTryoutAttempt, {
        product: "snbt",
        locale: "id",
        tryoutSlug: "2026-reporting-attempt",
      });

    expect(result?.attempt.irtScore).toBe(500);
    expect(result?.partAttempts[0]?.score?.irtScore).toBe(500);
  });

  it("derives part-level and parent attempt scores from theta in part reads", async () => {
    const t = createTestConvex();
    const identity = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, "part-reporting");
      const tryout = await insertTryoutSkeleton(ctx, "2026-reporting-part");

      await insertCompletedTryoutAttempt(ctx, {
        scaleVersionId: tryout.scaleVersionId,
        setId: tryout.setId,
        slug: "2026-reporting-part",
        tryoutId: tryout.tryoutId,
        userId: identity.userId,
      });

      return identity;
    });

    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .query(api.tryouts.queries.me.part.getUserTryoutPartAttempt, {
        product: "snbt",
        locale: "id",
        tryoutSlug: "2026-reporting-part",
        partKey: "quantitative-knowledge",
      });

    expect(result?.partScore?.irtScore).toBe(500);
    expect(result?.tryoutAttempt.irtScore).toBe(500);
  });

  it("derives leaderboard scores from theta instead of the stored leaderboard snapshot", async () => {
    const t = createTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(
        ctx,
        "leaderboard-reporting"
      );
      const tryout = await insertTryoutSkeleton(
        ctx,
        "2026-reporting-leaderboard"
      );
      const leaderboardEntryId = await ctx.db.insert(
        "tryoutLeaderboardEntries",
        {
          tryoutId: tryout.tryoutId,
          userId: identity.userId,
          leaderboardNamespace: "snbt:id:2026",
          theta: 0,
          thetaSE: 1,
          rawScore: 0,
          completedAt: NOW,
          attemptId: await ctx.db.insert("tryoutAttempts", {
            userId: identity.userId,
            tryoutId: tryout.tryoutId,
            scaleVersionId: tryout.scaleVersionId,
            scoreStatus: "official",
            status: "completed",
            partSetSnapshots: [
              {
                partIndex: 0,
                partKey: "quantitative-knowledge",
                questionCount: 20,
                setId: tryout.setId,
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
          }),
        }
      );

      return {
        leaderboardEntryId,
        tryoutId: tryout.tryoutId,
      };
    });

    vi.spyOn(tryoutLeaderboard, "paginate").mockResolvedValue({
      page: [{ id: state.leaderboardEntryId }],
    } as never);

    const result = await t.query(
      api.tryouts.queries.leaderboard.getTryoutLeaderboard,
      {
        tryoutId: state.tryoutId,
        limit: 10,
      }
    );

    expect(result).toEqual([
      expect.objectContaining({
        irtScore: 500,
        rank: 1,
        rawScore: 0,
        theta: 0,
      }),
    ]);
  });

  it("stores leaderboard entries without persisting a legacy irtScore field", async () => {
    const t = createTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, "leaderboard-write");
      const tryout = await insertTryoutSkeleton(
        ctx,
        "2026-reporting-leaderboard-write"
      );
      const { tryoutAttemptId } = await insertCompletedTryoutAttempt(ctx, {
        scaleVersionId: tryout.scaleVersionId,
        setId: tryout.setId,
        slug: "2026-reporting-leaderboard-write",
        tryoutId: tryout.tryoutId,
        userId: identity.userId,
      });

      return {
        tryoutAttemptId,
        tryoutId: tryout.tryoutId,
        userId: identity.userId,
      };
    });

    await t.mutation(
      internal.tryouts.mutations.internal.leaderboard.updateLeaderboard,
      {
        tryoutAttemptId: state.tryoutAttemptId,
      }
    );

    const leaderboardEntry = await t.query(async (ctx) => {
      return await ctx.db
        .query("tryoutLeaderboardEntries")
        .withIndex("by_tryoutId_and_userId", (q) =>
          q.eq("tryoutId", state.tryoutId).eq("userId", state.userId)
        )
        .unique();
    });

    expect(leaderboardEntry).not.toBeNull();
    expect(leaderboardEntry?.theta).toBe(0);

    if (!leaderboardEntry) {
      return;
    }

    expect("irtScore" in leaderboardEntry).toBe(false);
  });

  it("syncs finalized tryout aggregates without writing a persisted irtScore", async () => {
    const t = createTestConvex();
    const result = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, "aggregate-sync");
      const tryout = await insertTryoutSkeleton(
        ctx,
        "2026-reporting-aggregate",
        1
      );
      const { tryoutAttemptId } = await insertSingleQuestionCompletedAttempt(
        ctx,
        {
          scaleVersionId: tryout.scaleVersionId,
          setId: tryout.setId,
          slug: "2026-reporting-aggregate",
          tryoutId: tryout.tryoutId,
          userId: identity.userId,
        }
      );

      const aggregate = await syncTryoutAttemptAggregates({
        completedAtMs: NOW,
        ctx,
        now: NOW,
        status: "completed",
        tryoutAttemptId,
      });
      const storedAttempt = await ctx.db.get("tryoutAttempts", tryoutAttemptId);

      return {
        aggregate,
        storedAttempt,
      };
    });

    expect(result.aggregate.irtScore).toBe(
      snbtTryoutProductPolicy.scaleThetaToScore(result.aggregate.theta)
    );

    if (!result.storedAttempt) {
      return;
    }

    expect("irtScore" in result.storedAttempt).toBe(false);
  });

  it("returns derived report scores from finalizeTryoutAttempt across attempt states", async () => {
    const t = createTestConvex();
    const result = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, "finalize-reporting");
      const tryout = await insertTryoutSkeleton(ctx, "2026-reporting-finalize");
      const completedAttemptId = await ctx.db.insert("tryoutAttempts", {
        userId: identity.userId,
        tryoutId: tryout.tryoutId,
        scaleVersionId: tryout.scaleVersionId,
        scoreStatus: "official",
        status: "completed",
        partSetSnapshots: [
          {
            partIndex: 0,
            partKey: "quantitative-knowledge",
            questionCount: 20,
            setId: tryout.setId,
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
      const expiredAttemptId = await ctx.db.insert("tryoutAttempts", {
        userId: identity.userId,
        tryoutId: tryout.tryoutId,
        scaleVersionId: tryout.scaleVersionId,
        scoreStatus: "official",
        status: "expired",
        partSetSnapshots: [
          {
            partIndex: 0,
            partKey: "quantitative-knowledge",
            questionCount: 20,
            setId: tryout.setId,
          },
        ],
        completedPartIndices: [],
        totalCorrect: 0,
        totalQuestions: 20,
        theta: 0,
        thetaSE: 1,
        startedAt: NOW,
        expiresAt: NOW + ATTEMPT_WINDOW_MS,
        lastActivityAt: NOW,
        completedAt: NOW,
        endReason: "time-expired",
      });
      const inProgressAttemptId = await ctx.db.insert("tryoutAttempts", {
        userId: identity.userId,
        tryoutId: tryout.tryoutId,
        scaleVersionId: tryout.scaleVersionId,
        scoreStatus: "official",
        status: "in-progress",
        partSetSnapshots: [
          {
            partIndex: 0,
            partKey: "quantitative-knowledge",
            questionCount: 20,
            setId: tryout.setId,
          },
        ],
        completedPartIndices: [],
        totalCorrect: 0,
        totalQuestions: 0,
        theta: 0,
        thetaSE: 1,
        startedAt: NOW,
        expiresAt: NOW + ATTEMPT_WINDOW_MS,
        lastActivityAt: NOW,
        completedAt: null,
        endReason: null,
      });
      const completedAttempt = await ctx.db.get(
        "tryoutAttempts",
        completedAttemptId
      );
      const expiredAttempt = await ctx.db.get(
        "tryoutAttempts",
        expiredAttemptId
      );
      const inProgressAttempt = await ctx.db.get(
        "tryoutAttempts",
        inProgressAttemptId
      );

      if (!(completedAttempt && expiredAttempt && inProgressAttempt)) {
        throw new Error("Expected seeded tryout attempts to exist");
      }

      return {
        completed: await finalizeTryoutAttempt({
          ctx,
          now: NOW,
          tryoutAttempt: completedAttempt,
          userId: identity.userId,
        }),
        expired: await finalizeTryoutAttempt({
          ctx,
          now: NOW,
          tryoutAttempt: expiredAttempt,
          userId: identity.userId,
        }),
        inProgress: await finalizeTryoutAttempt({
          ctx,
          now: NOW,
          tryoutAttempt: inProgressAttempt,
          userId: identity.userId,
        }),
      };
    });

    expect(result.completed.irtScore).toBe(500);
    expect(result.expired.irtScore).toBe(500);
    expect(result.inProgress.irtScore).toBe(500);
  });

  it("treats never-started parts as wrong after tryout expiry in result reads", async () => {
    const t = createTestConvex();
    const identity = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(
        ctx,
        "expired-missing-parts"
      );
      const firstSetId = await ctx.db.insert("exerciseSets", {
        locale: "id",
        slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/expired-missing-parts-qk",
        category: "high-school",
        type: "snbt",
        material: "quantitative-knowledge",
        exerciseType: "try-out",
        setName: "expired-missing-parts-qk",
        title: "Quantitative Knowledge",
        questionCount: 1,
        syncedAt: NOW,
      });
      const secondSetId = await ctx.db.insert("exerciseSets", {
        locale: "id",
        slug: "exercises/high-school/snbt/mathematical-reasoning/try-out/2026/expired-missing-parts-mr",
        category: "high-school",
        type: "snbt",
        material: "mathematical-reasoning",
        exerciseType: "try-out",
        setName: "expired-missing-parts-mr",
        title: "Mathematical Reasoning",
        questionCount: 1,
        syncedAt: NOW,
      });
      const tryoutId = await ctx.db.insert("tryouts", {
        product: "snbt",
        locale: "id",
        cycleKey: "2026",
        slug: "expired-missing-parts",
        label: "Expired Missing Parts",
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
      const firstQuestionId = await insertExerciseQuestion(
        ctx,
        firstSetId,
        "expired-missing-parts-qk"
      );
      const secondQuestionId = await insertExerciseQuestion(
        ctx,
        secondSetId,
        "expired-missing-parts-mr"
      );
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
        slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/expired-missing-parts-qk",
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
        slug: "expired-missing-parts",
        status: "expired",
        expiresAtMs: NOW + ATTEMPT_WINDOW_MS,
        updatedAt: NOW,
      });

      return identity;
    });

    const attemptResult = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .query(api.tryouts.queries.me.attempt.getUserTryoutAttempt, {
        product: "snbt",
        locale: "id",
        tryoutSlug: "expired-missing-parts",
      });

    expect(attemptResult?.attempt.totalCorrect).toBe(0);
    expect(attemptResult?.attempt.totalQuestions).toBe(2);
    expect(attemptResult?.partAttempts).toHaveLength(2);
    expect(
      attemptResult?.partAttempts.map((part) => part.score?.correctAnswers)
    ).toEqual([0, 0]);
    expect(attemptResult?.partAttempts[1]?.setAttempt).toBeNull();

    const partResult = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .query(api.tryouts.queries.me.part.getUserTryoutPartAttempt, {
        product: "snbt",
        locale: "id",
        tryoutSlug: "expired-missing-parts",
        partKey: "mathematical-reasoning",
      });

    expect(partResult?.partAttempt).toBeNull();
    expect(partResult?.partScore?.correctAnswers).toBe(0);
    expect(partResult?.tryoutAttempt.totalQuestions).toBe(2);

    const startedPartResult = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .query(api.tryouts.queries.me.part.getUserTryoutPartAttempt, {
        product: "snbt",
        locale: "id",
        tryoutSlug: "expired-missing-parts",
        partKey: "quantitative-knowledge",
      });

    expect(startedPartResult?.partAttempt).not.toBeNull();
    expect(startedPartResult?.tryoutAttempt.totalQuestions).toBe(2);
    expect(startedPartResult?.tryoutAttempt.totalCorrect).toBe(0);
  });

  it("rebuilds finalized snapshots from persisted part set IDs and attempt question counts", async () => {
    const t = createTestConvex();

    const result = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(
        ctx,
        "snapshot-persisted-set"
      );
      const originalSetId = await ctx.db.insert("exerciseSets", {
        locale: "id",
        slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/snapshot-original",
        category: "high-school",
        type: "snbt",
        material: "quantitative-knowledge",
        exerciseType: "try-out",
        setName: "snapshot-original",
        title: "Original Set",
        questionCount: 1,
        syncedAt: NOW,
      });
      const replacementSetId = await ctx.db.insert("exerciseSets", {
        locale: "id",
        slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/snapshot-replacement",
        category: "high-school",
        type: "snbt",
        material: "quantitative-knowledge",
        exerciseType: "try-out",
        setName: "snapshot-replacement",
        title: "Replacement Set",
        questionCount: 2,
        syncedAt: NOW,
      });
      const tryoutId = await ctx.db.insert("tryouts", {
        product: "snbt",
        locale: "id",
        cycleKey: "2026",
        slug: "snapshot-persisted-set",
        label: "Snapshot Persisted Set",
        partCount: 1,
        totalQuestionCount: 1,
        isActive: true,
        detectedAt: NOW,
        syncedAt: NOW,
      });
      const tryoutPartSetId = await ctx.db.insert("tryoutPartSets", {
        tryoutId,
        setId: originalSetId,
        partIndex: 0,
        partKey: "quantitative-knowledge",
      });
      const scaleVersionId = await ctx.db.insert("irtScaleVersions", {
        tryoutId,
        model: "2pl",
        status: "official",
        questionCount: 1,
        publishedAt: NOW,
      });
      const originalQuestionId = await insertExerciseQuestion(
        ctx,
        originalSetId,
        "snapshot-original"
      );
      const replacementQuestionId = await insertExerciseQuestion(
        ctx,
        replacementSetId,
        "snapshot-replacement"
      );
      const originalRunId = await ctx.db.insert("irtCalibrationRuns", {
        setId: originalSetId,
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
      const replacementRunId = await ctx.db.insert("irtCalibrationRuns", {
        setId: replacementSetId,
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
        calibrationRunId: originalRunId,
        questionId: originalQuestionId,
        setId: originalSetId,
        difficulty: 0,
        discrimination: 1,
      });
      await ctx.db.insert("irtScaleVersionItems", {
        scaleVersionId,
        calibrationRunId: replacementRunId,
        questionId: replacementQuestionId,
        setId: replacementSetId,
        difficulty: 0,
        discrimination: 1,
      });

      const setAttemptId = await ctx.db.insert("exerciseAttempts", {
        slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/snapshot-original",
        userId: identity.userId,
        origin: "tryout",
        mode: "simulation",
        scope: "set",
        timeLimit: 90,
        startedAt: NOW,
        lastActivityAt: NOW,
        completedAt: NOW,
        endReason: "submitted",
        status: "completed",
        updatedAt: NOW,
        totalExercises: 1,
        answeredCount: 1,
        correctAnswers: 1,
        totalTime: 90,
        scorePercentage: 100,
      });
      const tryoutAttemptId = await ctx.db.insert("tryoutAttempts", {
        userId: identity.userId,
        tryoutId,
        scaleVersionId,
        scoreStatus: "official",
        status: "completed",
        partSetSnapshots: [
          {
            partIndex: 0,
            partKey: "quantitative-knowledge",
            questionCount: 1,
            setId: originalSetId,
          },
        ],
        completedPartIndices: [0],
        totalCorrect: 0,
        totalQuestions: 0,
        theta: 0,
        thetaSE: 1,
        startedAt: NOW,
        expiresAt: NOW + ATTEMPT_WINDOW_MS,
        lastActivityAt: NOW,
        completedAt: NOW,
        endReason: "submitted",
      });

      await ctx.db.insert("exerciseAnswers", {
        attemptId: setAttemptId,
        exerciseNumber: 1,
        questionId: originalQuestionId,
        isCorrect: true,
        timeSpent: 90,
        answeredAt: NOW,
        updatedAt: NOW,
      });
      await ctx.db.insert("tryoutPartAttempts", {
        tryoutAttemptId,
        partIndex: 0,
        partKey: "quantitative-knowledge",
        setAttemptId,
        setId: originalSetId,
        theta: 0,
        thetaSE: 1,
      });

      await ctx.db.patch("tryoutPartSets", tryoutPartSetId, {
        setId: replacementSetId,
      });

      const snapshot = await buildFinalizedTryoutSnapshot(ctx.db, {
        scaleVersionId,
        tryout: {
          _id: tryoutId,
          partCount: 1,
          product: "snbt",
          totalQuestionCount: 1,
        },
        tryoutAttempt: {
          _id: tryoutAttemptId,
          completedPartIndices: [0],
          partSetSnapshots: [
            {
              partIndex: 0,
              partKey: "quantitative-knowledge",
              questionCount: 1,
              setId: originalSetId,
            },
          ],
        },
      });

      return {
        snapshot,
      };
    });

    expect(result.snapshot.totalQuestions).toBe(1);
    expect(result.snapshot.partSnapshots[0]?.score.correctAnswers).toBe(1);
    expect(result.snapshot.partSnapshots[0]?.score.irtScore).toBeGreaterThan(
      500
    );
  });
});
