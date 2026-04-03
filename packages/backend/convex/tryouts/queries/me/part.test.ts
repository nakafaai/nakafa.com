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
    const identity = await t.mutation(async (ctx) => {
      return await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "no-part-attempt",
      });
    });

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

  it("returns zero-score summaries for untouched ended parts", async () => {
    const t = createTryoutTestConvex();
    const { identity, tryoutSlug } = await t.mutation(async (ctx) => {
      return await seedExpiredTryoutWithUntouchedPart(
        ctx,
        "expired-missing-parts"
      );
    });

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
      const tryoutAttemptId = await ctx.db.insert("tryoutAttempts", {
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
        totalQuestions: 0,
        theta: 0,
        thetaSE: 1,
        startedAt: NOW,
        expiresAt: NOW + 30 * 60 * 1000,
        lastActivityAt: NOW,
        completedAt: NOW,
        endReason: "time-expired",
      });

      await ctx.db.insert("userTryoutLatestAttempts", {
        userId: identity.userId,
        product: "snbt",
        locale: "id",
        tryoutId: tryout.tryoutId,
        attemptId: tryoutAttemptId,
        slug: "missing-snapshot-part-key",
        status: "expired",
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
        slug: "in-progress-part",
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
        .withIndex("by_tryoutAttemptId_and_partKey", (q) =>
          q
            .eq("tryoutAttemptId", tryoutAttemptId)
            .eq("partKey", "quantitative-knowledge")
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
        .withIndex("by_tryoutAttemptId_and_partKey", (q) =>
          q
            .eq("tryoutAttemptId", tryoutAttemptId)
            .eq("partKey", "quantitative-knowledge")
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
