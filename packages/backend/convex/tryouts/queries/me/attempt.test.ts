import { api } from "@repo/backend/convex/_generated/api";
import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import {
  createTryoutTestConvex,
  insertCompletedTryoutAttempt,
  insertTryoutSkeleton,
  NOW,
  seedExpiredTryoutWithUntouchedPart,
} from "@repo/backend/convex/tryouts/test.helpers";
import { describe, expect, it } from "vitest";

describe("tryouts/queries/me/attempt", () => {
  it("returns null when the user has no latest attempt for the requested tryout", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation(async (ctx) => {
      return await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "no-attempt",
      });
    });

    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .query(api.tryouts.queries.me.attempt.getUserTryoutAttempt, {
        product: "snbt",
        locale: "id",
        tryoutSlug: "missing-tryout",
      });

    expect(result).toBeNull();
  });

  it("derives the latest tryout score from theta instead of a stored legacy score", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "attempt-reporting",
      });
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

  it("treats never-started parts as wrong after tryout expiry in attempt reads", async () => {
    const t = createTryoutTestConvex();
    const { identity, tryoutSlug } = await t.mutation(async (ctx) => {
      return await seedExpiredTryoutWithUntouchedPart(
        ctx,
        "expired-missing-parts"
      );
    });

    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .query(api.tryouts.queries.me.attempt.getUserTryoutAttempt, {
        product: "snbt",
        locale: "id",
        tryoutSlug,
      });

    expect(result?.attempt.totalCorrect).toBe(0);
    expect(result?.attempt.totalQuestions).toBe(2);
    expect(result?.partAttempts).toHaveLength(2);
    expect(
      result?.partAttempts.map(
        (partAttempt) => partAttempt.score?.correctAnswers
      )
    ).toEqual([0, 0]);
    expect(result?.partAttempts[1]?.setAttempt).toBeNull();
  });

  it("uses the persisted snapshot length when live tryout partCount shrinks", async () => {
    const t = createTryoutTestConvex();
    const { identity, tryoutSlug } = await t.mutation(async (ctx) => {
      const seeded = await seedExpiredTryoutWithUntouchedPart(
        ctx,
        "expired-partcount-shrink"
      );
      const latestAttempt = await ctx.db
        .query("userTryoutLatestAttempts")
        .withIndex("by_userId_and_product_and_locale_and_updatedAt", (q) =>
          q
            .eq("userId", seeded.identity.userId)
            .eq("product", "snbt")
            .eq("locale", "id")
        )
        .order("desc")
        .first();

      if (!latestAttempt) {
        throw new Error("Expected latest tryout attempt to exist");
      }

      const removedPartSet = await ctx.db
        .query("tryoutPartSets")
        .withIndex("by_tryoutId_and_partIndex", (q) =>
          q.eq("tryoutId", latestAttempt.tryoutId).eq("partIndex", 1)
        )
        .unique();

      await ctx.db.patch("tryouts", latestAttempt.tryoutId, {
        partCount: 1,
        totalQuestionCount: 1,
      });

      if (removedPartSet) {
        await ctx.db.delete("tryoutPartSets", removedPartSet._id);
      }

      return seeded;
    });

    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .query(api.tryouts.queries.me.attempt.getUserTryoutAttempt, {
        product: "snbt",
        locale: "id",
        tryoutSlug,
      });

    expect(result?.attempt.totalQuestions).toBe(2);
    expect(result?.partAttempts).toHaveLength(2);
    expect(result?.partAttempts[1]?.score?.correctAnswers).toBe(0);
  });

  it("throws when a persisted part attempt is missing its exercise attempt", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "missing-exercise-attempt",
      });
      const tryout = await insertTryoutSkeleton(
        ctx,
        "missing-exercise-attempt"
      );
      const { setAttemptId } = await insertCompletedTryoutAttempt(ctx, {
        scaleVersionId: tryout.scaleVersionId,
        setId: tryout.setId,
        slug: "missing-exercise-attempt",
        tryoutId: tryout.tryoutId,
        userId: identity.userId,
      });

      await ctx.db.delete(setAttemptId);

      return identity;
    });

    await expect(
      t
        .withIdentity({
          subject: identity.authUserId,
          sessionId: identity.sessionId,
        })
        .query(api.tryouts.queries.me.attempt.getUserTryoutAttempt, {
          product: "snbt",
          locale: "id",
          tryoutSlug: "missing-exercise-attempt",
        })
    ).rejects.toThrow("Part attempt is missing its exercise attempt.");
  });

  it("throws when a finalized attempt resolves a started part without a score", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "missing-final-score",
      });
      const tryout = await insertTryoutSkeleton(ctx, "missing-final-score");
      const { tryoutAttemptId } = await insertCompletedTryoutAttempt(ctx, {
        scaleVersionId: tryout.scaleVersionId,
        setId: tryout.setId,
        slug: "missing-final-score",
        tryoutId: tryout.tryoutId,
        userId: identity.userId,
      });
      const partAttempt = await ctx.db
        .query("tryoutPartAttempts")
        .withIndex("by_tryoutAttemptId_and_partIndex", (q) =>
          q.eq("tryoutAttemptId", tryoutAttemptId).eq("partIndex", 0)
        )
        .unique();

      if (!partAttempt) {
        throw new Error("Expected tryout part attempt to exist");
      }

      await ctx.db.patch("tryoutPartAttempts", partAttempt._id, {
        partIndex: 1,
      });

      return identity;
    });

    await expect(
      t
        .withIdentity({
          subject: identity.authUserId,
          sessionId: identity.sessionId,
        })
        .query(api.tryouts.queries.me.attempt.getUserTryoutAttempt, {
          product: "snbt",
          locale: "id",
          tryoutSlug: "missing-final-score",
        })
    ).rejects.toThrow("Finalized tryout is missing one of its part scores.");
  });

  it("returns the resume part for in-progress attempts", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "in-progress-resume",
      });
      const tryout = await insertTryoutSkeleton(ctx, "in-progress-resume");
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
        expiresAt: NOW + 30 * 60 * 1000,
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
        slug: "in-progress-resume",
        status: "in-progress",
        expiresAtMs: NOW + 30 * 60 * 1000,
        updatedAt: NOW,
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
        tryoutSlug: "in-progress-resume",
      });

    expect(result?.resumePartKey).toBe("quantitative-knowledge");
  });

  it("returns the current route part key when mappings rename an in-progress part", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "resume-current-key",
      });
      const tryout = await insertTryoutSkeleton(ctx, "resume-current-key");
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
        expiresAt: NOW + 30 * 60 * 1000,
        lastActivityAt: NOW,
        completedAt: null,
        endReason: null,
      });

      await ctx.db.patch("tryoutPartSets", tryoutPartSet._id, {
        partKey: "mathematical-reasoning",
      });
      await ctx.db.insert("userTryoutLatestAttempts", {
        userId: identity.userId,
        product: "snbt",
        locale: "id",
        tryoutId: tryout.tryoutId,
        attemptId: tryoutAttemptId,
        slug: "resume-current-key",
        status: "in-progress",
        expiresAtMs: NOW + 30 * 60 * 1000,
        updatedAt: NOW,
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
        tryoutSlug: "resume-current-key",
      });

    expect(result?.resumePartKey).toBe("mathematical-reasoning");
    expect(result?.orderedParts).toEqual([
      {
        partIndex: 0,
        partKey: "mathematical-reasoning",
      },
    ]);
  });

  it("keeps ordered part keys aligned by key when live part order changes", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "ordered-part-key-reorder",
      });
      const firstSetId = await ctx.db.insert("exerciseSets", {
        locale: "id",
        slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/ordered-part-key-reorder-qk",
        category: "high-school",
        type: "snbt",
        material: "quantitative-knowledge",
        exerciseType: "try-out",
        setName: "ordered-part-key-reorder-qk",
        title: "Quantitative Knowledge",
        questionCount: 10,
        syncedAt: NOW,
      });
      const secondSetId = await ctx.db.insert("exerciseSets", {
        locale: "id",
        slug: "exercises/high-school/snbt/mathematical-reasoning/try-out/2026/ordered-part-key-reorder-mr",
        category: "high-school",
        type: "snbt",
        material: "mathematical-reasoning",
        exerciseType: "try-out",
        setName: "ordered-part-key-reorder-mr",
        title: "Mathematical Reasoning",
        questionCount: 10,
        syncedAt: NOW,
      });
      const tryoutId = await ctx.db.insert("tryouts", {
        product: "snbt",
        locale: "id",
        cycleKey: "2026",
        slug: "ordered-part-key-reorder",
        label: "Ordered Part Key Reorder",
        partCount: 2,
        totalQuestionCount: 20,
        isActive: true,
        detectedAt: NOW,
        syncedAt: NOW,
      });
      const scaleVersionId = await ctx.db.insert("irtScaleVersions", {
        tryoutId,
        model: "2pl",
        status: "official",
        questionCount: 20,
        publishedAt: NOW,
      });
      const firstPartSetId = await ctx.db.insert("tryoutPartSets", {
        tryoutId,
        setId: firstSetId,
        partIndex: 0,
        partKey: "quantitative-knowledge",
      });
      const secondPartSetId = await ctx.db.insert("tryoutPartSets", {
        tryoutId,
        setId: secondSetId,
        partIndex: 1,
        partKey: "mathematical-reasoning",
      });
      const tryoutAttemptId = await ctx.db.insert("tryoutAttempts", {
        userId: identity.userId,
        tryoutId,
        scaleVersionId,
        scoreStatus: "official",
        status: "in-progress",
        partSetSnapshots: [
          {
            partIndex: 0,
            partKey: "quantitative-knowledge",
            questionCount: 10,
            setId: firstSetId,
          },
          {
            partIndex: 1,
            partKey: "mathematical-reasoning",
            questionCount: 10,
            setId: secondSetId,
          },
        ],
        completedPartIndices: [],
        totalCorrect: 0,
        totalQuestions: 0,
        theta: 0,
        thetaSE: 1,
        startedAt: NOW,
        expiresAt: NOW + 30 * 60 * 1000,
        lastActivityAt: NOW,
        completedAt: null,
        endReason: null,
      });

      await ctx.db.insert("userTryoutLatestAttempts", {
        userId: identity.userId,
        product: "snbt",
        locale: "id",
        tryoutId,
        attemptId: tryoutAttemptId,
        slug: "ordered-part-key-reorder",
        status: "in-progress",
        expiresAtMs: NOW + 30 * 60 * 1000,
        updatedAt: NOW,
      });
      await ctx.db.patch("tryoutPartSets", firstPartSetId, {
        partKey: "mathematical-reasoning",
        setId: secondSetId,
      });
      await ctx.db.patch("tryoutPartSets", secondPartSetId, {
        partKey: "quantitative-knowledge",
        setId: firstSetId,
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
        tryoutSlug: "ordered-part-key-reorder",
      });

    expect(result?.orderedParts).toEqual([
      {
        partIndex: 0,
        partKey: "quantitative-knowledge",
      },
      {
        partIndex: 1,
        partKey: "mathematical-reasoning",
      },
    ]);
  });

  it("keeps translated route keys one-to-one when a historical key moves and another key is renamed", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "ordered-part-key-collision",
      });
      const firstSetId = await ctx.db.insert("exerciseSets", {
        locale: "id",
        slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/ordered-part-key-collision-qk",
        category: "high-school",
        type: "snbt",
        material: "quantitative-knowledge",
        exerciseType: "try-out",
        setName: "ordered-part-key-collision-qk",
        title: "Quantitative Knowledge",
        questionCount: 10,
        syncedAt: NOW,
      });
      const secondSetId = await ctx.db.insert("exerciseSets", {
        locale: "id",
        slug: "exercises/high-school/snbt/mathematical-reasoning/try-out/2026/ordered-part-key-collision-mr",
        category: "high-school",
        type: "snbt",
        material: "mathematical-reasoning",
        exerciseType: "try-out",
        setName: "ordered-part-key-collision-mr",
        title: "Mathematical Reasoning",
        questionCount: 10,
        syncedAt: NOW,
      });
      const tryoutId = await ctx.db.insert("tryouts", {
        product: "snbt",
        locale: "id",
        cycleKey: "2026",
        slug: "ordered-part-key-collision",
        label: "Ordered Part Key Collision",
        partCount: 2,
        totalQuestionCount: 20,
        isActive: true,
        detectedAt: NOW,
        syncedAt: NOW,
      });
      const scaleVersionId = await ctx.db.insert("irtScaleVersions", {
        tryoutId,
        model: "2pl",
        status: "official",
        questionCount: 20,
        publishedAt: NOW,
      });
      const firstPartSetId = await ctx.db.insert("tryoutPartSets", {
        tryoutId,
        setId: firstSetId,
        partIndex: 0,
        partKey: "quantitative-knowledge",
      });
      const secondPartSetId = await ctx.db.insert("tryoutPartSets", {
        tryoutId,
        setId: secondSetId,
        partIndex: 1,
        partKey: "mathematical-reasoning",
      });
      const tryoutAttemptId = await ctx.db.insert("tryoutAttempts", {
        userId: identity.userId,
        tryoutId,
        scaleVersionId,
        scoreStatus: "official",
        status: "in-progress",
        partSetSnapshots: [
          {
            partIndex: 0,
            partKey: "quantitative-knowledge",
            questionCount: 10,
            setId: firstSetId,
          },
          {
            partIndex: 1,
            partKey: "mathematical-reasoning",
            questionCount: 10,
            setId: secondSetId,
          },
        ],
        completedPartIndices: [],
        totalCorrect: 0,
        totalQuestions: 0,
        theta: 0,
        thetaSE: 1,
        startedAt: NOW,
        expiresAt: NOW + 30 * 60 * 1000,
        lastActivityAt: NOW,
        completedAt: null,
        endReason: null,
      });

      await ctx.db.insert("userTryoutLatestAttempts", {
        userId: identity.userId,
        product: "snbt",
        locale: "id",
        tryoutId,
        attemptId: tryoutAttemptId,
        slug: "ordered-part-key-collision",
        status: "in-progress",
        expiresAtMs: NOW + 30 * 60 * 1000,
        updatedAt: NOW,
      });
      await ctx.db.patch("tryoutPartSets", firstPartSetId, {
        partKey: "mathematical-reasoning",
      });
      await ctx.db.patch("tryoutPartSets", secondPartSetId, {
        partKey: "verbal-reasoning",
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
        tryoutSlug: "ordered-part-key-collision",
      });

    expect(result?.orderedParts).toEqual([
      {
        partIndex: 0,
        partKey: "verbal-reasoning",
      },
      {
        partIndex: 1,
        partKey: "mathematical-reasoning",
      },
    ]);
    expect(
      result?.partAttempts.map((partAttempt) => partAttempt.partKey)
    ).toEqual(["verbal-reasoning", "mathematical-reasoning"]);
    expect(result?.resumePartKey).toBe("verbal-reasoning");
  });

  it("uses snapshot length when live tryout partCount shrinks below started parts", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "in-progress-partcount-shrink",
      });
      const firstSetId = await ctx.db.insert("exerciseSets", {
        locale: "id",
        slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/in-progress-partcount-shrink-qk",
        category: "high-school",
        type: "snbt",
        material: "quantitative-knowledge",
        exerciseType: "try-out",
        setName: "in-progress-partcount-shrink-qk",
        title: "Quantitative Knowledge",
        questionCount: 1,
        syncedAt: NOW,
      });
      const secondSetId = await ctx.db.insert("exerciseSets", {
        locale: "id",
        slug: "exercises/high-school/snbt/mathematical-reasoning/try-out/2026/in-progress-partcount-shrink-mr",
        category: "high-school",
        type: "snbt",
        material: "mathematical-reasoning",
        exerciseType: "try-out",
        setName: "in-progress-partcount-shrink-mr",
        title: "Mathematical Reasoning",
        questionCount: 1,
        syncedAt: NOW,
      });
      const tryoutId = await ctx.db.insert("tryouts", {
        product: "snbt",
        locale: "id",
        cycleKey: "2026",
        slug: "in-progress-partcount-shrink",
        label: "In Progress Partcount Shrink",
        partCount: 2,
        totalQuestionCount: 2,
        isActive: true,
        detectedAt: NOW,
        syncedAt: NOW,
      });
      const scaleVersionId = await ctx.db.insert("irtScaleVersions", {
        tryoutId,
        model: "2pl",
        status: "official",
        questionCount: 2,
        publishedAt: NOW,
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

      const firstSetAttemptId = await ctx.db.insert("exerciseAttempts", {
        slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/in-progress-partcount-shrink-qk",
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
        answeredCount: 0,
        correctAnswers: 0,
        totalTime: 0,
        scorePercentage: 0,
      });
      const secondSetAttemptId = await ctx.db.insert("exerciseAttempts", {
        slug: "exercises/high-school/snbt/mathematical-reasoning/try-out/2026/in-progress-partcount-shrink-mr",
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
        answeredCount: 0,
        correctAnswers: 0,
        totalTime: 0,
        scorePercentage: 0,
      });
      const tryoutAttemptId = await ctx.db.insert("tryoutAttempts", {
        userId: identity.userId,
        tryoutId,
        scaleVersionId,
        scoreStatus: "official",
        status: "in-progress",
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
        completedPartIndices: [],
        totalCorrect: 0,
        totalQuestions: 0,
        theta: 0,
        thetaSE: 1,
        startedAt: NOW,
        expiresAt: NOW + 30 * 60 * 1000,
        lastActivityAt: NOW,
        completedAt: null,
        endReason: null,
      });

      await ctx.db.insert("tryoutPartAttempts", {
        tryoutAttemptId,
        partIndex: 0,
        partKey: "quantitative-knowledge",
        setAttemptId: firstSetAttemptId,
        setId: firstSetId,
        theta: 0,
        thetaSE: 1,
      });
      await ctx.db.insert("tryoutPartAttempts", {
        tryoutAttemptId,
        partIndex: 1,
        partKey: "mathematical-reasoning",
        setAttemptId: secondSetAttemptId,
        setId: secondSetId,
        theta: 0,
        thetaSE: 1,
      });
      await ctx.db.insert("userTryoutLatestAttempts", {
        userId: identity.userId,
        product: "snbt",
        locale: "id",
        tryoutId,
        attemptId: tryoutAttemptId,
        slug: "in-progress-partcount-shrink",
        status: "in-progress",
        expiresAtMs: NOW + 30 * 60 * 1000,
        updatedAt: NOW,
      });
      await ctx.db.patch("tryouts", tryoutId, {
        partCount: 1,
        totalQuestionCount: 1,
      });
      const removedPartSet = await ctx.db
        .query("tryoutPartSets")
        .withIndex("by_tryoutId_and_partIndex", (q) =>
          q.eq("tryoutId", tryoutId).eq("partIndex", 1)
        )
        .unique();

      if (removedPartSet) {
        await ctx.db.delete("tryoutPartSets", removedPartSet._id);
      }

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
        tryoutSlug: "in-progress-partcount-shrink",
      });

    expect(result?.partAttempts).toHaveLength(2);
    expect(
      result?.partAttempts.map((partAttempt) => partAttempt.partKey)
    ).toEqual(["quantitative-knowledge", "mathematical-reasoning"]);
  });
});
