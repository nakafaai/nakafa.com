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
        .withIndex("by_tryoutAttemptId_and_partKey", (q) =>
          q
            .eq("tryoutAttemptId", tryoutAttemptId)
            .eq("partKey", "quantitative-knowledge")
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
});
