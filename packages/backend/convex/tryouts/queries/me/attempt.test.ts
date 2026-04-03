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
});
