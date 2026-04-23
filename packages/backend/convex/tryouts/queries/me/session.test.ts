import { api } from "@repo/backend/convex/_generated/api";
import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import {
  createTryoutTestConvex,
  insertCompletedTryoutAttempt,
  insertTryoutSkeleton,
  NOW,
} from "@repo/backend/convex/tryouts/test.helpers";
import { describe, expect, it } from "vitest";

describe("tryouts/queries/me/session", () => {
  it("returns null when the user has no resolved tryout attempt", async () => {
    const t = createTryoutTestConvex();
    const identity = await t.mutation(
      async (ctx) =>
        await seedAuthenticatedUser(ctx, {
          now: NOW,
          suffix: "session-missing",
        })
    );

    const result = await t
      .withIdentity({
        subject: identity.authUserId,
        sessionId: identity.sessionId,
      })
      .query(api.tryouts.queries.me.session.getUserTryoutSession, {
        product: "snbt",
        locale: "id",
        tryoutSlug: "missing-tryout",
      });

    expect(result).toBeNull();
  });

  it("returns the explicitly selected historical attempt when it is valid", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "session-selected",
      });
      const tryout = await insertTryoutSkeleton(ctx, "session-selected");
      const olderAttempt = await insertCompletedTryoutAttempt(ctx, {
        scaleVersionId: tryout.scaleVersionId,
        setId: tryout.setId,
        slug: "session-selected-older",
        tryoutId: tryout.tryoutId,
        userId: identity.userId,
      });
      const latestAttempt = await insertCompletedTryoutAttempt(ctx, {
        scaleVersionId: tryout.scaleVersionId,
        setId: tryout.setId,
        slug: "session-selected-latest",
        tryoutId: tryout.tryoutId,
        userId: identity.userId,
      });

      await ctx.db.patch("tryoutAttempts", olderAttempt.tryoutAttemptId, {
        expiresAt: NOW + 10,
        startedAt: NOW,
        status: "completed",
      });
      await ctx.db.patch("tryoutAttempts", latestAttempt.tryoutAttemptId, {
        expiresAt: NOW + 20,
        startedAt: NOW + 1,
        status: "completed",
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
      .query(api.tryouts.queries.me.session.getUserTryoutSession, {
        attemptId: state.olderAttemptId,
        product: "snbt",
        locale: "id",
        tryoutSlug: "session-selected",
      });

    expect(result).toEqual({
      attemptId: state.olderAttemptId,
      expiresAtMs: NOW + 10,
      status: "completed",
    });
  });

  it("falls back to the latest attempt when the requested attempt id is invalid", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "session-latest",
      });
      const tryout = await insertTryoutSkeleton(ctx, "session-latest");

      await insertCompletedTryoutAttempt(ctx, {
        scaleVersionId: tryout.scaleVersionId,
        setId: tryout.setId,
        slug: "session-latest-older",
        tryoutId: tryout.tryoutId,
        userId: identity.userId,
      });
      const latestAttempt = await insertCompletedTryoutAttempt(ctx, {
        scaleVersionId: tryout.scaleVersionId,
        setId: tryout.setId,
        slug: "session-latest-newest",
        tryoutId: tryout.tryoutId,
        userId: identity.userId,
      });

      await ctx.db.patch("tryoutAttempts", latestAttempt.tryoutAttemptId, {
        expiresAt: NOW + 30,
        startedAt: NOW + 2,
        status: "in-progress",
      });

      return {
        identity,
        latestAttemptId: latestAttempt.tryoutAttemptId,
      };
    });

    const result = await t
      .withIdentity({
        subject: state.identity.authUserId,
        sessionId: state.identity.sessionId,
      })
      .query(api.tryouts.queries.me.session.getUserTryoutSession, {
        attemptId: "not-a-valid-tryout-attempt-id",
        product: "snbt",
        locale: "id",
        tryoutSlug: "session-latest",
      });

    expect(result).toEqual({
      attemptId: state.latestAttemptId,
      expiresAtMs: NOW + 30,
      status: "in-progress",
    });
  });
});
