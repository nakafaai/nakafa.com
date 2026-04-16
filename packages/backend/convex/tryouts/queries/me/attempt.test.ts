import { api } from "@repo/backend/convex/_generated/api";
import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import { insertTryoutAccessCampaign } from "@repo/backend/convex/tryoutAccess/test.helpers";
import {
  ATTEMPT_WINDOW_MS,
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
    const identity = await t.mutation(
      async (ctx) =>
        await seedAuthenticatedUser(ctx, {
          now: NOW,
          suffix: "no-attempt",
        })
    );

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

  it("returns the explicitly selected historical attempt instead of the latest one", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "selected-historical-attempt",
      });
      const tryout = await insertTryoutSkeleton(
        ctx,
        "selected-historical-attempt"
      );
      const olderAttempt = await insertCompletedTryoutAttempt(ctx, {
        scaleVersionId: tryout.scaleVersionId,
        setId: tryout.setId,
        slug: "selected-historical-attempt-older",
        tryoutId: tryout.tryoutId,
        userId: identity.userId,
      });
      const latestAttempt = await insertCompletedTryoutAttempt(ctx, {
        scaleVersionId: tryout.scaleVersionId,
        setId: tryout.setId,
        slug: "selected-historical-attempt-latest",
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
        theta: -1,
        totalCorrect: 3,
      });
      await ctx.db.patch("exerciseAttempts", olderAttempt.setAttemptId, {
        correctAnswers: 3,
      });
      await ctx.db.patch("tryoutPartAttempts", olderPartAttempt._id, {
        theta: -1.25,
        thetaSE: 0.75,
      });
      await ctx.db.patch("tryoutAttempts", latestAttempt.tryoutAttemptId, {
        completedAt: NOW + 1000,
        lastActivityAt: NOW + 1000,
        startedAt: NOW + 1000,
        theta: 1,
        totalCorrect: 9,
      });
      await ctx.db.patch("exerciseAttempts", latestAttempt.setAttemptId, {
        correctAnswers: 9,
      });
      await ctx.db.patch("tryoutPartAttempts", latestPartAttempt._id, {
        theta: 0.75,
        thetaSE: 0.35,
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
      .query(api.tryouts.queries.me.attempt.getUserTryoutAttempt, {
        attemptId: state.olderAttemptId,
        product: "snbt",
        locale: "id",
        tryoutSlug: "selected-historical-attempt",
      });

    expect(result?.attempt._id).toBe(state.olderAttemptId);
    expect(result?.attempt.totalCorrect).toBe(3);
    expect(result?.partAttempts[0]?.score?.theta).toBe(-1.25);
  });

  it("falls back to the latest attempt when the selected attempt belongs to a different tryout", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "selected-attempt-fallback",
      });
      const requestedTryout = await insertTryoutSkeleton(
        ctx,
        "selected-attempt-fallback-requested"
      );
      const otherTryout = await insertTryoutSkeleton(
        ctx,
        "selected-attempt-fallback-other"
      );
      const requestedAttempt = await insertCompletedTryoutAttempt(ctx, {
        scaleVersionId: requestedTryout.scaleVersionId,
        setId: requestedTryout.setId,
        slug: "selected-attempt-fallback-requested",
        tryoutId: requestedTryout.tryoutId,
        userId: identity.userId,
      });
      const otherAttempt = await insertCompletedTryoutAttempt(ctx, {
        scaleVersionId: otherTryout.scaleVersionId,
        setId: otherTryout.setId,
        slug: "selected-attempt-fallback-other",
        tryoutId: otherTryout.tryoutId,
        userId: identity.userId,
      });

      await ctx.db.patch("tryoutAttempts", requestedAttempt.tryoutAttemptId, {
        completedAt: NOW + 1000,
        lastActivityAt: NOW + 1000,
        startedAt: NOW + 1000,
        totalCorrect: 7,
      });
      await ctx.db.patch("tryoutAttempts", otherAttempt.tryoutAttemptId, {
        totalCorrect: 1,
      });

      return {
        identity,
        otherAttemptId: otherAttempt.tryoutAttemptId,
        requestedAttemptId: requestedAttempt.tryoutAttemptId,
      };
    });

    const result = await t
      .withIdentity({
        subject: state.identity.authUserId,
        sessionId: state.identity.sessionId,
      })
      .query(api.tryouts.queries.me.attempt.getUserTryoutAttempt, {
        attemptId: state.otherAttemptId,
        product: "snbt",
        locale: "id",
        tryoutSlug: "selected-attempt-fallback-requested",
      });

    expect(result?.attempt._id).toBe(state.requestedAttemptId);
    expect(result?.attempt.totalCorrect).toBe(7);
  });

  it("treats never-started parts as wrong after tryout expiry in attempt reads", async () => {
    const t = createTryoutTestConvex();
    const { identity, tryoutSlug } = await t.mutation(
      async (ctx) =>
        await seedExpiredTryoutWithUntouchedPart(ctx, "expired-missing-parts")
    );

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
        catalogPosition: 1,
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
      await ctx.db.insert("tryoutAttempts", {
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
        catalogPosition: 1,
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
      await ctx.db.insert("tryoutAttempts", {
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

  it("derives the public final-event label for finalized competition attempts", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "final-event-status",
      });
      const tryout = await insertTryoutSkeleton(ctx, "final-event-status");
      const campaignId = await insertTryoutAccessCampaign(ctx, {
        slug: "final-event-status",
        name: "Final Event Status",
        targetProducts: ["snbt"],
        campaignKind: "competition",
        enabled: true,
        redeemStatus: "ended",
        resultsStatus: "finalized",
        resultsFinalizedAt: NOW,
        startsAt: NOW - 24 * 60 * 60 * 1000,
        endsAt: NOW - 1,
      });
      const linkId = await ctx.db.insert("tryoutAccessLinks", {
        campaignId,
        code: "final-event-status",
        label: "Final Event Status",
        enabled: true,
      });
      const grantId = await ctx.db.insert("tryoutAccessGrants", {
        campaignId,
        linkId,
        userId: identity.userId,
        redeemedAt: NOW - 24 * 60 * 60 * 1000,
        endsAt: NOW - 1,
        status: "expired",
      });
      const setAttemptId = await ctx.db.insert("exerciseAttempts", {
        slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/final-event-status",
        userId: identity.userId,
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
        correctAnswers: 12,
        totalTime: 1800,
        scorePercentage: 60,
      });
      const tryoutAttemptId = await ctx.db.insert("tryoutAttempts", {
        userId: identity.userId,
        tryoutId: tryout.tryoutId,
        scaleVersionId: tryout.scaleVersionId,
        accessKind: "event",
        accessCampaignId: campaignId,
        accessCampaignKind: "competition",
        accessGrantId: grantId,
        accessEndsAt: NOW - 1,
        countsForCompetition: true,
        scoreStatus: "provisional",
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
        attemptNumber: 1,
        totalCorrect: 12,
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
        setId: tryout.setId,
        theta: 0,
        thetaSE: 1,
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
        tryoutSlug: "final-event-status",
      });

    expect(result?.attempt.publicResultStatus).toBe("final-event");
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
        catalogPosition: 1,
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
