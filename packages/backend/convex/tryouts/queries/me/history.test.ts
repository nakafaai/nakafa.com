import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import { insertTryoutAccessCampaign } from "@repo/backend/convex/tryoutAccess/test.helpers";
import {
  ATTEMPT_WINDOW_MS,
  createTryoutTestConvex,
  insertTryoutSkeleton,
  NOW,
  seedExpiredTryoutWithUntouchedPart,
} from "@repo/backend/convex/tryouts/test.helpers";
import { describe, expect, it } from "vitest";

describe("tryouts/queries/me/history", () => {
  it("returns numbered attempts and the single public status label for each row", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "attempt-history",
      });
      const tryout = await insertTryoutSkeleton(ctx, "attempt-history");
      const campaignId = await insertTryoutAccessCampaign(ctx, {
        slug: "attempt-history",
        name: "Attempt History",
        products: ["snbt"],
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
        code: "attempt-history",
        label: "Attempt History",
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

      await ctx.db.insert("tryoutAttempts", {
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
        totalCorrect: 10,
        totalQuestions: 20,
        theta: 0,
        thetaSE: 1,
        startedAt: NOW,
        expiresAt: NOW + 1,
        lastActivityAt: NOW,
        completedAt: NOW,
        endReason: "submitted",
      });
      await ctx.db.insert("tryoutAttempts", {
        userId: identity.userId,
        tryoutId: tryout.tryoutId,
        scaleVersionId: tryout.scaleVersionId,
        accessKind: "subscription",
        countsForCompetition: false,
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
        totalCorrect: 12,
        totalQuestions: 20,
        theta: 1,
        thetaSE: 0.5,
        startedAt: NOW + 1,
        expiresAt: NOW + ATTEMPT_WINDOW_MS,
        lastActivityAt: NOW + 1,
        completedAt: NOW + 1,
        endReason: "submitted",
      });

      return identity;
    });

    const result = await t
      .withIdentity({
        subject: state.authUserId,
        sessionId: state.sessionId,
      })
      .query(api.tryouts.queries.me.history.getUserTryoutAttemptHistory, {
        paginationOpts: {
          cursor: null,
          numItems: 10,
        },
        product: "snbt",
        locale: "id",
        tryoutSlug: "attempt-history",
      });

    expect(result.isDone).toBe(true);
    expect(result.page).toEqual([
      expect.objectContaining({
        countsForCompetition: false,
        publicResultStatus: "verified-irt",
      }),
      expect.objectContaining({
        countsForCompetition: true,
        publicResultStatus: "final-event",
      }),
    ]);
  });

  it("repairs ended history rows from the finalized snapshot when later parts were never started", async () => {
    const t = createTryoutTestConvex();
    const { identity, tryoutSlug } = await t.mutation(async (ctx) => {
      return await seedExpiredTryoutWithUntouchedPart(
        ctx,
        "history-finalized-snapshot"
      );
    });

    const [attemptResult, historyResult] = await Promise.all([
      t
        .withIdentity({
          subject: identity.authUserId,
          sessionId: identity.sessionId,
        })
        .query(api.tryouts.queries.me.attempt.getUserTryoutAttempt, {
          product: "snbt",
          locale: "id",
          tryoutSlug,
        }),
      t
        .withIdentity({
          subject: identity.authUserId,
          sessionId: identity.sessionId,
        })
        .query(api.tryouts.queries.me.history.getUserTryoutAttemptHistory, {
          paginationOpts: {
            cursor: null,
            numItems: 10,
          },
          product: "snbt",
          locale: "id",
          tryoutSlug,
        }),
    ]);

    expect(historyResult.page).toHaveLength(1);
    expect(historyResult.page[0]?.irtScore).toBe(
      attemptResult?.attempt.irtScore
    );
    expect(historyResult.page[0]?.totalCorrect).toBe(
      attemptResult?.attempt.totalCorrect
    );
    expect(historyResult.page[0]?.totalQuestions).toBe(
      attemptResult?.attempt.totalQuestions
    );
  });

  it("returns additional history pages instead of throwing at a fixed cap", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "attempt-history-pagination",
      });
      const tryout = await insertTryoutSkeleton(
        ctx,
        "attempt-history-pagination"
      );
      const attemptIds: Id<"tryoutAttempts">[] = [];

      for (let index = 0; index < 3; index += 1) {
        const attemptId = await ctx.db.insert("tryoutAttempts", {
          userId: identity.userId,
          tryoutId: tryout.tryoutId,
          scaleVersionId: tryout.scaleVersionId,
          accessKind: "subscription",
          countsForCompetition: false,
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
          totalCorrect: 10 + index,
          totalQuestions: 20,
          theta: index,
          thetaSE: 0.5,
          startedAt: NOW + index,
          expiresAt: NOW + ATTEMPT_WINDOW_MS + index,
          lastActivityAt: NOW + index,
          completedAt: NOW + index,
          endReason: "submitted",
        });

        attemptIds.push(attemptId);
      }

      return identity;
    });

    const firstPage = await t
      .withIdentity({
        subject: state.authUserId,
        sessionId: state.sessionId,
      })
      .query(api.tryouts.queries.me.history.getUserTryoutAttemptHistory, {
        paginationOpts: {
          cursor: null,
          numItems: 2,
        },
        product: "snbt",
        locale: "id",
        tryoutSlug: "attempt-history-pagination",
      });

    expect(firstPage.isDone).toBe(false);
    expect(firstPage.page).toHaveLength(2);

    const secondPage = await t
      .withIdentity({
        subject: state.authUserId,
        sessionId: state.sessionId,
      })
      .query(api.tryouts.queries.me.history.getUserTryoutAttemptHistory, {
        paginationOpts: {
          cursor: firstPage.continueCursor,
          numItems: 2,
        },
        product: "snbt",
        locale: "id",
        tryoutSlug: "attempt-history-pagination",
      });

    expect(secondPage.page).toHaveLength(1);
    expect(secondPage.isDone).toBe(true);
  });
});
