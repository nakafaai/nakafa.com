import { api } from "@repo/backend/convex/_generated/api";
import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import {
  ATTEMPT_WINDOW_MS,
  createTryoutTestConvex,
  insertExerciseQuestion,
  insertTryoutSkeleton,
  NOW,
} from "@repo/backend/convex/tryouts/test.helpers";
import { products } from "@repo/backend/convex/utils/polar/products";
import { describe, expect, it } from "vitest";

describe("tryouts/mutations/attempts", () => {
  it("starts new tryout attempts without persisting a legacy irtScore field", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "start-reporting",
      });
      const tryout = await insertTryoutSkeleton(ctx, "2026-reporting-start");

      await ctx.db.insert("customers", {
        id: "customer-start-reporting",
        externalId: null,
        metadata: {},
        userId: identity.userId,
      });
      await ctx.db.insert("subscriptions", {
        id: "subscription-start-reporting",
        customerId: "customer-start-reporting",
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

  it("starts an unstarted part from the persisted snapshot after live key and set changes", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "start-renamed-part",
      });
      const tryout = await insertTryoutSkeleton(ctx, "start-renamed-part");
      const replacementSetId = await ctx.db.insert("exerciseSets", {
        locale: "id",
        slug: "exercises/high-school/snbt/mathematical-reasoning/try-out/2026/start-renamed-part-mr",
        category: "high-school",
        type: "snbt",
        material: "mathematical-reasoning",
        exerciseType: "try-out",
        setName: "start-renamed-part-mr",
        title: "Mathematical Reasoning",
        questionCount: 15,
        syncedAt: NOW,
      });
      const tryoutPartSet = await ctx.db
        .query("tryoutPartSets")
        .withIndex("by_tryoutId_and_partIndex", (q) =>
          q.eq("tryoutId", tryout.tryoutId)
        )
        .unique();

      if (!tryoutPartSet) {
        throw new Error("Expected tryout part set to exist");
      }

      const tryoutAttemptId = await ctx.db.insert("tryoutAttempts", {
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

      await ctx.db.patch("tryoutPartSets", tryoutPartSet._id, {
        partKey: "mathematical-reasoning",
        setId: replacementSetId,
      });

      return {
        ...identity,
        originalSetId: tryout.setId,
        tryoutAttemptId,
      };
    });

    await t
      .withIdentity({
        subject: state.authUserId,
        sessionId: state.sessionId,
      })
      .mutation(api.tryouts.mutations.attempts.startPart, {
        partKey: "mathematical-reasoning",
        tryoutAttemptId: state.tryoutAttemptId,
      });

    const result = await t.query(async (ctx) => {
      const partAttempt = await ctx.db
        .query("tryoutPartAttempts")
        .withIndex("by_tryoutAttemptId_and_partIndex", (q) =>
          q.eq("tryoutAttemptId", state.tryoutAttemptId).eq("partIndex", 0)
        )
        .unique();

      if (!partAttempt) {
        return null;
      }

      return {
        partAttempt,
        setAttempt: await ctx.db.get(
          "exerciseAttempts",
          partAttempt.setAttemptId
        ),
      };
    });

    expect(result?.partAttempt.partKey).toBe("quantitative-knowledge");
    expect(result?.partAttempt.setId).toBe(state.originalSetId);
    expect(result?.setAttempt?.totalExercises).toBe(20);
  });

  it("reuses an already started part after the current route key changes", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "reuse-renamed-part",
      });
      const tryout = await insertTryoutSkeleton(ctx, "reuse-renamed-part", 1);
      const questionId = await insertExerciseQuestion(ctx, tryout.setId, {
        slug: "reuse-renamed-part",
      });
      const tryoutPartSet = await ctx.db
        .query("tryoutPartSets")
        .withIndex("by_tryoutId_and_partIndex", (q) =>
          q.eq("tryoutId", tryout.tryoutId)
        )
        .unique();

      if (!tryoutPartSet) {
        throw new Error("Expected tryout part set to exist");
      }

      const setAttemptId = await ctx.db.insert("exerciseAttempts", {
        slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/reuse-renamed-part",
        userId: identity.userId,
        origin: "tryout",
        mode: "simulation",
        scope: "set",
        timeLimit: 24 * 60 * 60,
        startedAt: NOW,
        lastActivityAt: NOW,
        completedAt: null,
        endReason: null,
        status: "in-progress",
        updatedAt: NOW,
        totalExercises: 1,
        answeredCount: 0,
        correctAnswers: 0,
        totalTime: 0,
        scorePercentage: 0,
      });
      const tryoutAttemptId = await ctx.db.insert("tryoutAttempts", {
        userId: identity.userId,
        tryoutId: tryout.tryoutId,
        scaleVersionId: tryout.scaleVersionId,
        scoreStatus: "official",
        status: "in-progress",
        partSetSnapshots: [
          {
            partIndex: 0,
            partKey: "quantitative-knowledge",
            questionCount: 1,
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

      await ctx.db.insert("exerciseAnswers", {
        attemptId: setAttemptId,
        exerciseNumber: 1,
        questionId,
        isCorrect: false,
        timeSpent: 30,
        answeredAt: NOW,
        updatedAt: NOW,
      });
      await ctx.db.insert("tryoutPartAttempts", {
        tryoutAttemptId,
        partIndex: 0,
        partKey: "quantitative-knowledge",
        setAttemptId,
        setId: tryout.setId,
        theta: 0,
        thetaSE: 1,
      });
      await ctx.db.patch("tryoutPartSets", tryoutPartSet._id, {
        partKey: "mathematical-reasoning",
      });

      return {
        ...identity,
        setAttemptId,
        tryoutAttemptId,
      };
    });

    await t
      .withIdentity({
        subject: state.authUserId,
        sessionId: state.sessionId,
      })
      .mutation(api.tryouts.mutations.attempts.startPart, {
        partKey: "mathematical-reasoning",
        tryoutAttemptId: state.tryoutAttemptId,
      });

    const result = await t.query(async (ctx) => {
      return await ctx.db
        .query("tryoutPartAttempts")
        .withIndex("by_tryoutAttemptId_and_partIndex", (q) =>
          q.eq("tryoutAttemptId", state.tryoutAttemptId).eq("partIndex", 0)
        )
        .take(2);
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.setAttemptId).toBe(state.setAttemptId);
  });

  it("completes a renamed part by its stable part index", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "complete-renamed-part",
      });
      const tryout = await insertTryoutSkeleton(
        ctx,
        "complete-renamed-part",
        1
      );
      await ctx.db.patch("irtScaleVersions", tryout.scaleVersionId, {
        status: "provisional",
      });
      const questionId = await insertExerciseQuestion(ctx, tryout.setId, {
        slug: "complete-renamed-part",
      });
      const tryoutPartSet = await ctx.db
        .query("tryoutPartSets")
        .withIndex("by_tryoutId_and_partIndex", (q) =>
          q.eq("tryoutId", tryout.tryoutId)
        )
        .unique();

      if (!tryoutPartSet) {
        throw new Error("Expected tryout part set to exist");
      }

      await ctx.db.insert("irtScaleVersionItems", {
        scaleVersionId: tryout.scaleVersionId,
        calibrationRunId: await ctx.db.insert("irtCalibrationRuns", {
          setId: tryout.setId,
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
        setId: tryout.setId,
        difficulty: 0,
        discrimination: 1,
      });

      const setAttemptId = await ctx.db.insert("exerciseAttempts", {
        slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/complete-renamed-part",
        userId: identity.userId,
        origin: "tryout",
        mode: "simulation",
        scope: "set",
        timeLimit: 90,
        startedAt: NOW,
        lastActivityAt: NOW,
        completedAt: null,
        endReason: null,
        status: "in-progress",
        updatedAt: NOW,
        totalExercises: 1,
        answeredCount: 1,
        correctAnswers: 1,
        totalTime: 0,
        scorePercentage: 100,
      });
      const tryoutAttemptId = await ctx.db.insert("tryoutAttempts", {
        userId: identity.userId,
        tryoutId: tryout.tryoutId,
        scaleVersionId: tryout.scaleVersionId,
        scoreStatus: "provisional",
        status: "in-progress",
        partSetSnapshots: [
          {
            partIndex: 0,
            partKey: "quantitative-knowledge",
            questionCount: 1,
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

      await ctx.db.insert("exerciseAnswers", {
        attemptId: setAttemptId,
        exerciseNumber: 1,
        questionId,
        isCorrect: true,
        timeSpent: 30,
        answeredAt: NOW,
        updatedAt: NOW,
      });
      await ctx.db.insert("tryoutPartAttempts", {
        tryoutAttemptId,
        partIndex: 0,
        partKey: "quantitative-knowledge",
        setAttemptId,
        setId: tryout.setId,
        theta: 0,
        thetaSE: 1,
      });
      await ctx.db.patch("tryoutPartSets", tryoutPartSet._id, {
        partKey: "mathematical-reasoning",
      });

      return {
        ...identity,
        tryoutAttemptId,
      };
    });

    await t
      .withIdentity({
        subject: state.authUserId,
        sessionId: state.sessionId,
      })
      .mutation(api.tryouts.mutations.attempts.completePart, {
        partKey: "mathematical-reasoning",
        tryoutAttemptId: state.tryoutAttemptId,
      });

    const result = await t.query(async (ctx) => {
      return await ctx.db.get("tryoutAttempts", state.tryoutAttemptId);
    });

    expect(result?.completedPartIndices).toEqual([0]);
  });

  it("reuses a partially completed attempt after live partCount shrinks", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "reuse-shrunk-partcount",
      });
      const tryout = await insertTryoutSkeleton(ctx, "reuse-shrunk-partcount");

      await ctx.db.patch("tryouts", tryout.tryoutId, {
        partCount: 2,
        totalQuestionCount: 40,
      });
      const secondSetId = await ctx.db.insert("exerciseSets", {
        locale: "id",
        slug: "exercises/high-school/snbt/mathematical-reasoning/try-out/2026/reuse-shrunk-partcount-mr",
        category: "high-school",
        type: "snbt",
        material: "mathematical-reasoning",
        exerciseType: "try-out",
        setName: "reuse-shrunk-partcount-mr",
        title: "Mathematical Reasoning",
        questionCount: 20,
        syncedAt: NOW,
      });

      await ctx.db.insert("tryoutPartSets", {
        tryoutId: tryout.tryoutId,
        setId: secondSetId,
        partIndex: 1,
        partKey: "mathematical-reasoning",
      });

      const tryoutAttemptId = await ctx.db.insert("tryoutAttempts", {
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
          {
            partIndex: 1,
            partKey: "mathematical-reasoning",
            questionCount: 20,
            setId: secondSetId,
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
        completedAt: null,
        endReason: null,
      });

      await ctx.db.insert("userTryoutLatestAttempts", {
        userId: identity.userId,
        product: "snbt",
        locale: "id",
        tryoutId: tryout.tryoutId,
        attemptId: tryoutAttemptId,
        slug: "reuse-shrunk-partcount",
        status: "in-progress",
        expiresAtMs: NOW + ATTEMPT_WINDOW_MS,
        updatedAt: NOW,
      });
      await ctx.db.patch("tryouts", tryout.tryoutId, {
        partCount: 1,
        totalQuestionCount: 20,
      });

      return {
        ...identity,
        tryoutId: tryout.tryoutId,
      };
    });

    await t
      .withIdentity({
        subject: state.authUserId,
        sessionId: state.sessionId,
      })
      .mutation(api.tryouts.mutations.attempts.startTryout, {
        product: "snbt",
        locale: "id",
        tryoutSlug: "reuse-shrunk-partcount",
      });

    const attempts = await t.query(async (ctx) => {
      return await ctx.db
        .query("tryoutAttempts")
        .withIndex("by_userId_and_tryoutId_and_startedAt", (q) =>
          q.eq("userId", state.userId).eq("tryoutId", state.tryoutId)
        )
        .collect();
    });

    expect(attempts).toHaveLength(1);
  });
});
