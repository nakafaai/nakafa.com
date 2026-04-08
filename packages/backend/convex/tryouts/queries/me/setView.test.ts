import { api } from "@repo/backend/convex/_generated/api";
import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import {
  createTryoutTestConvex,
  insertCompletedTryoutAttempt,
  insertTryoutSkeleton,
  NOW,
} from "@repo/backend/convex/tryouts/test.helpers";
import { describe, expect, it } from "vitest";

describe("tryouts/queries/me/setView", () => {
  it("returns the selected attempt together with the first history page", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "set-view",
      });
      const tryout = await insertTryoutSkeleton(ctx, "set-view");
      const olderAttempt = await insertCompletedTryoutAttempt(ctx, {
        scaleVersionId: tryout.scaleVersionId,
        setId: tryout.setId,
        slug: "set-view-older",
        tryoutId: tryout.tryoutId,
        userId: identity.userId,
      });
      const latestAttempt = await insertCompletedTryoutAttempt(ctx, {
        scaleVersionId: tryout.scaleVersionId,
        setId: tryout.setId,
        slug: "set-view-latest",
        tryoutId: tryout.tryoutId,
        userId: identity.userId,
      });

      await ctx.db.patch("tryoutAttempts", olderAttempt.tryoutAttemptId, {
        completedAt: NOW,
        lastActivityAt: NOW,
        startedAt: NOW,
        totalCorrect: 4,
      });
      await ctx.db.patch("exerciseAttempts", olderAttempt.setAttemptId, {
        correctAnswers: 4,
      });
      await ctx.db.patch("tryoutAttempts", latestAttempt.tryoutAttemptId, {
        completedAt: NOW + 1,
        lastActivityAt: NOW + 1,
        startedAt: NOW + 1,
        totalCorrect: 9,
      });
      await ctx.db.patch("exerciseAttempts", latestAttempt.setAttemptId, {
        correctAnswers: 9,
      });

      return {
        identity,
        latestAttemptId: latestAttempt.tryoutAttemptId,
        olderAttemptId: olderAttempt.tryoutAttemptId,
      };
    });

    const result = await t
      .withIdentity({
        subject: state.identity.authUserId,
        sessionId: state.identity.sessionId,
      })
      .query(api.tryouts.queries.me.setView.getUserTryoutSetView, {
        attemptId: state.olderAttemptId,
        product: "snbt",
        locale: "id",
        tryoutSlug: "set-view",
      });

    expect(result?.attemptData.attempt._id).toBe(state.olderAttemptId);
    expect(result?.attemptData.attempt.totalCorrect).toBe(4);
    expect(result?.initialHistory.page.map((row) => row.attemptId)).toEqual([
      state.latestAttemptId,
      state.olderAttemptId,
    ]);
  });
});
