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

describe("tryouts/queries/me/part", () => {
  it("returns null when the user has no latest part context for the requested tryout", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation(
      async (ctx) =>
        await seedAuthenticatedUser(ctx, {
          now: NOW,
          suffix: "no-part-attempt",
        })
    );

    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .query(api.tryouts.queries.me.part.getUserTryoutPartAttempt, {
        product: "snbt",
        locale: "id",
        tryoutSlug: "missing-tryout",
        partKey: "quantitative-knowledge",
      });

    expect(result).toBeNull();
  });

  it("derives part-level and parent attempt scores from theta in part reads", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "part-reporting",
      });
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

  it("returns the explicitly selected historical part runtime instead of the latest one", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "selected-historical-part",
      });
      const tryout = await insertTryoutSkeleton(
        ctx,
        "selected-historical-part"
      );
      const olderAttempt = await insertCompletedTryoutAttempt(ctx, {
        scaleVersionId: tryout.scaleVersionId,
        setId: tryout.setId,
        slug: "selected-historical-part-older",
        tryoutId: tryout.tryoutId,
        userId: identity.userId,
      });
      const latestAttempt = await insertCompletedTryoutAttempt(ctx, {
        scaleVersionId: tryout.scaleVersionId,
        setId: tryout.setId,
        slug: "selected-historical-part-latest",
        tryoutId: tryout.tryoutId,
        userId: identity.userId,
      });
      const olderPartAttempt = await ctx.db
        .query("tryoutPartAttempts")
        .withIndex("by_tryoutAttemptId_and_partIndex", (q) =>
          q
            .eq("tryoutAttemptId", olderAttempt.tryoutAttemptId)
            .eq("partIndex", 0)
        )
        .unique();
      const latestPartAttempt = await ctx.db
        .query("tryoutPartAttempts")
        .withIndex("by_tryoutAttemptId_and_partIndex", (q) =>
          q
            .eq("tryoutAttemptId", latestAttempt.tryoutAttemptId)
            .eq("partIndex", 0)
        )
        .unique();

      if (!(olderPartAttempt && latestPartAttempt)) {
        throw new Error("Expected both part attempts to exist");
      }

      await ctx.db.patch("tryoutAttempts", olderAttempt.tryoutAttemptId, {
        completedAt: NOW,
        lastActivityAt: NOW,
        startedAt: NOW,
        totalCorrect: 2,
      });
      await ctx.db.patch("tryoutAttempts", latestAttempt.tryoutAttemptId, {
        completedAt: NOW + 1000,
        lastActivityAt: NOW + 1000,
        startedAt: NOW + 1000,
        totalCorrect: 8,
      });
      await ctx.db.patch("tryoutPartAttempts", olderPartAttempt._id, {
        theta: -0.9,
        thetaSE: 0.6,
      });
      await ctx.db.patch("tryoutPartAttempts", latestPartAttempt._id, {
        theta: 0.8,
        thetaSE: 0.3,
      });

      return {
        identity,
        olderAttemptId: olderAttempt.tryoutAttemptId,
      };
    });

    const result = await t
      .withIdentity({
        subject: state.identity.authUserId,
        sessionId: state.identity.sessionId,
      })
      .query(api.tryouts.queries.me.part.getUserTryoutPartAttempt, {
        attemptId: state.olderAttemptId,
        product: "snbt",
        locale: "id",
        tryoutSlug: "selected-historical-part",
        partKey: "quantitative-knowledge",
      });

    expect(result?.tryoutAttempt._id).toBe(state.olderAttemptId);
    expect(result?.partScore?.theta).toBe(-0.9);
  });

  it("returns finalized part data when the current route key was renamed", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "renamed-part-route",
      });
      const tryout = await insertTryoutSkeleton(ctx, "renamed-part-route");
      const tryoutPartSet = await ctx.db
        .query("tryoutPartSets")
        .withIndex("by_tryoutId_and_partIndex", (q) =>
          q.eq("tryoutId", tryout.tryoutId)
        )
        .unique();

      if (!tryoutPartSet) {
        throw new Error("Expected tryout part set to exist");
      }

      await insertCompletedTryoutAttempt(ctx, {
        scaleVersionId: tryout.scaleVersionId,
        setId: tryout.setId,
        slug: "renamed-part-route",
        tryoutId: tryout.tryoutId,
        userId: identity.userId,
      });
      await ctx.db.patch("tryoutPartSets", tryoutPartSet._id, {
        partKey: "mathematical-reasoning",
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
        tryoutSlug: "renamed-part-route",
        partKey: "mathematical-reasoning",
      });

    expect(result?.partAttempt?.partKey).toBe("mathematical-reasoning");
    expect(result?.partScore?.irtScore).toBe(500);
  });

  it("matches finalized part routes by key before falling back to part index", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "reordered-part-route",
      });
      const firstSetId = await ctx.db.insert("exerciseSets", {
        locale: "id",
        slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/reordered-part-route-qk",
        category: "high-school",
        type: "snbt",
        material: "quantitative-knowledge",
        exerciseType: "try-out",
        setName: "reordered-part-route-qk",
        title: "Quantitative Knowledge",
        questionCount: 10,
        syncedAt: NOW,
      });
      const secondSetId = await ctx.db.insert("exerciseSets", {
        locale: "id",
        slug: "exercises/high-school/snbt/mathematical-reasoning/try-out/2026/reordered-part-route-mr",
        category: "high-school",
        type: "snbt",
        material: "mathematical-reasoning",
        exerciseType: "try-out",
        setName: "reordered-part-route-mr",
        title: "Mathematical Reasoning",
        questionCount: 10,
        syncedAt: NOW,
      });
      const tryoutId = await ctx.db.insert("tryouts", {
        catalogPosition: 1,
        product: "snbt",
        locale: "id",
        cycleKey: "2026",
        slug: "reordered-part-route",
        label: "Reordered Part Route",
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
      const firstSetAttemptId = await ctx.db.insert("exerciseAttempts", {
        slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/reordered-part-route-qk",
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
        totalExercises: 10,
        answeredCount: 10,
        correctAnswers: 7,
        totalTime: 90,
        scorePercentage: 70,
      });
      const secondSetAttemptId = await ctx.db.insert("exerciseAttempts", {
        slug: "exercises/high-school/snbt/mathematical-reasoning/try-out/2026/reordered-part-route-mr",
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
        totalExercises: 10,
        answeredCount: 10,
        correctAnswers: 3,
        totalTime: 90,
        scorePercentage: 30,
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
        completedPartIndices: [0, 1],
        attemptNumber: 1,
        totalCorrect: 10,
        totalQuestions: 20,
        theta: 0,
        thetaSE: 1,
        startedAt: NOW,
        expiresAt: NOW + 30 * 60 * 1000,
        lastActivityAt: NOW,
        completedAt: NOW,
        endReason: "submitted",
      });

      await ctx.db.insert("tryoutPartAttempts", {
        tryoutAttemptId,
        partIndex: 0,
        partKey: "quantitative-knowledge",
        setAttemptId: firstSetAttemptId,
        setId: firstSetId,
        theta: 0.5,
        thetaSE: 0.8,
      });
      await ctx.db.insert("tryoutPartAttempts", {
        tryoutAttemptId,
        partIndex: 1,
        partKey: "mathematical-reasoning",
        setAttemptId: secondSetAttemptId,
        setId: secondSetId,
        theta: -0.5,
        thetaSE: 0.9,
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
      .query(api.tryouts.queries.me.part.getUserTryoutPartAttempt, {
        product: "snbt",
        locale: "id",
        tryoutSlug: "reordered-part-route",
        partKey: "quantitative-knowledge",
      });

    expect(result?.partAttempt?.partIndex).toBe(0);
    expect(result?.partAttempt?.partKey).toBe("quantitative-knowledge");
    expect(result?.partScore?.correctAnswers).toBe(7);
  });

  it("returns zero-score summaries for untouched ended parts", async () => {
    const t = createTryoutTestConvex();
    const { identity, tryoutSlug } = await t.mutation(
      async (ctx) =>
        await seedExpiredTryoutWithUntouchedPart(ctx, "expired-missing-parts")
    );

    const untouchedPartResult = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .query(api.tryouts.queries.me.part.getUserTryoutPartAttempt, {
        product: "snbt",
        locale: "id",
        tryoutSlug,
        partKey: "mathematical-reasoning",
      });

    expect(untouchedPartResult?.partAttempt).toBeNull();
    expect(untouchedPartResult?.partScore?.correctAnswers).toBe(0);
    expect(untouchedPartResult?.tryoutAttempt.totalQuestions).toBe(2);

    const startedPartResult = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .query(api.tryouts.queries.me.part.getUserTryoutPartAttempt, {
        product: "snbt",
        locale: "id",
        tryoutSlug,
        partKey: "quantitative-knowledge",
      });

    expect(startedPartResult?.partAttempt).not.toBeNull();
    expect(startedPartResult?.tryoutAttempt.totalQuestions).toBe(2);
    expect(startedPartResult?.tryoutAttempt.totalCorrect).toBe(0);
  });

  it("uses the persisted snapshot length when live tryout partCount shrinks", async () => {
    const t = createTryoutTestConvex();
    const { identity, tryoutSlug } = await t.mutation(async (ctx) => {
      const seeded = await seedExpiredTryoutWithUntouchedPart(
        ctx,
        "expired-partcount-shrink"
      );
      const tryout = await ctx.db
        .query("tryouts")
        .withIndex("by_product_and_locale_and_slug", (q) =>
          q
            .eq("product", "snbt")
            .eq("locale", "id")
            .eq("slug", seeded.tryoutSlug)
        )
        .unique();

      if (!tryout) {
        throw new Error("Expected tryout to exist");
      }

      const removedPartSet = await ctx.db
        .query("tryoutPartSets")
        .withIndex("by_tryoutId_and_partIndex", (q) =>
          q.eq("tryoutId", tryout._id).eq("partIndex", 1)
        )
        .unique();

      await ctx.db.patch("tryouts", tryout._id, {
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
      .query(api.tryouts.queries.me.part.getUserTryoutPartAttempt, {
        product: "snbt",
        locale: "id",
        tryoutSlug,
        partKey: "mathematical-reasoning",
      });

    expect(result?.partAttempt).toBeNull();
    expect(result?.partScore?.correctAnswers).toBe(0);
    expect(result?.tryoutAttempt.totalQuestions).toBe(2);
  });

  it("returns null part state when the requested finalized part key is not in the snapshot", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "missing-snapshot-part-key",
      });
      const tryout = await insertTryoutSkeleton(
        ctx,
        "missing-snapshot-part-key"
      );
      await ctx.db.insert("tryoutAttempts", {
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
        attemptNumber: 1,
        totalCorrect: 0,
        totalQuestions: 0,
        theta: 0,
        thetaSE: 1,
        startedAt: NOW,
        expiresAt: NOW + 30 * 60 * 1000,
        lastActivityAt: NOW,
        completedAt: NOW,
        endReason: "time-expired",
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
        tryoutSlug: "missing-snapshot-part-key",
        partKey: "mathematical-reasoning",
      });

    expect(result?.partAttempt).toBeNull();
    expect(result?.partScore).toBeNull();
  });

  it("returns null part state for in-progress parts that have not started yet", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "in-progress-part",
      });
      const tryout = await insertTryoutSkeleton(ctx, "in-progress-part");
      await ctx.db.insert("tryoutAttempts", {
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
        attemptNumber: 1,
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
        tryoutSlug: "in-progress-part",
        partKey: "quantitative-knowledge",
      });

    expect(result?.partAttempt).toBeNull();
    expect(result?.partScore).toBeNull();
  });

  it("throws when a finalized attempt is missing the requested part attempt", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "missing-part-attempt",
      });
      const tryout = await insertTryoutSkeleton(ctx, "missing-part-attempt");
      const { tryoutAttemptId } = await insertCompletedTryoutAttempt(ctx, {
        scaleVersionId: tryout.scaleVersionId,
        setId: tryout.setId,
        slug: "missing-part-attempt",
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

      await ctx.db.delete(partAttempt._id);

      return identity;
    });

    await expect(
      t
        .withIdentity({
          subject: identity.authUserId,
          sessionId: identity.sessionId,
        })
        .query(api.tryouts.queries.me.part.getUserTryoutPartAttempt, {
          product: "snbt",
          locale: "id",
          tryoutSlug: "missing-part-attempt",
          partKey: "quantitative-knowledge",
        })
    ).rejects.toThrow("Finalized tryout is missing its part attempt.");
  });

  it("throws when a persisted part attempt is missing its exercise attempt", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "missing-part-set-attempt",
      });
      const tryout = await insertTryoutSkeleton(
        ctx,
        "missing-part-set-attempt"
      );
      const { setAttemptId } = await insertCompletedTryoutAttempt(ctx, {
        scaleVersionId: tryout.scaleVersionId,
        setId: tryout.setId,
        slug: "missing-part-set-attempt",
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
        .query(api.tryouts.queries.me.part.getUserTryoutPartAttempt, {
          product: "snbt",
          locale: "id",
          tryoutSlug: "missing-part-set-attempt",
          partKey: "quantitative-knowledge",
        })
    ).rejects.toThrow("Tryout part is missing its exercise attempt.");
  });

  it("throws when a finalized part cannot resolve a score", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "missing-part-score",
      });
      const tryout = await insertTryoutSkeleton(ctx, "missing-part-score");
      const { tryoutAttemptId } = await insertCompletedTryoutAttempt(ctx, {
        scaleVersionId: tryout.scaleVersionId,
        setId: tryout.setId,
        slug: "missing-part-score",
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

      await ctx.db.patch("tryoutAttempts", tryoutAttemptId, {
        completedPartIndices: [1],
      });

      return identity;
    });

    await expect(
      t
        .withIdentity({
          subject: identity.authUserId,
          sessionId: identity.sessionId,
        })
        .query(api.tryouts.queries.me.part.getUserTryoutPartAttempt, {
          product: "snbt",
          locale: "id",
          tryoutSlug: "missing-part-score",
          partKey: "quantitative-knowledge",
        })
    ).rejects.toThrow("Finalized tryout part is missing its score.");
  });
});
