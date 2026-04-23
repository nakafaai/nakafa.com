import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
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

describe("tryouts/queries/me/history", () => {
  it("returns oldest-first attempt numbers on newest-first history rows", async () => {
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
        attemptNumber: 1,
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
        attemptNumber: 2,
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
        attemptNumber: 2,
        countsForCompetition: false,
        isLatest: true,
        publicResultStatus: "verified-irt",
      }),
      expect.objectContaining({
        attemptNumber: 1,
        countsForCompetition: true,
        isLatest: false,
        publicResultStatus: "final-event",
      }),
    ]);
  });

  it("repairs ended history rows from the finalized snapshot when later parts were never started", async () => {
    const t = createTryoutTestConvex();
    const { identity, tryoutSlug } = await t.mutation(
      async (ctx) =>
        await seedExpiredTryoutWithUntouchedPart(
          ctx,
          "history-finalized-snapshot"
        )
    );

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
          attemptNumber: index + 1,
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

  it("keeps newest-first history order while selected attempts still resolve", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "attempt-history-selection",
      });
      const tryout = await insertTryoutSkeleton(
        ctx,
        "attempt-history-selection"
      );
      const olderAttempt = await insertCompletedTryoutAttempt(ctx, {
        scaleVersionId: tryout.scaleVersionId,
        setId: tryout.setId,
        slug: "attempt-history-selection-older",
        tryoutId: tryout.tryoutId,
        userId: identity.userId,
      });
      const latestAttempt = await insertCompletedTryoutAttempt(ctx, {
        scaleVersionId: tryout.scaleVersionId,
        setId: tryout.setId,
        slug: "attempt-history-selection-latest",
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
        latestAttempt: latestAttempt.tryoutAttemptId,
        olderAttempt: olderAttempt.tryoutAttemptId,
      };
    });

    const history = await t
      .withIdentity({
        subject: state.identity.authUserId,
        sessionId: state.identity.sessionId,
      })
      .query(api.tryouts.queries.me.history.getUserTryoutAttemptHistory, {
        attemptId: state.olderAttempt,
        paginationOpts: {
          cursor: null,
          numItems: 10,
        },
        product: "snbt",
        locale: "id",
        tryoutSlug: "attempt-history-selection",
      });
    const selectedHistoryRow = history.page.find(
      (row) => row.attemptId === state.olderAttempt
    );

    const selectedAttempt = await t
      .withIdentity({
        subject: state.identity.authUserId,
        sessionId: state.identity.sessionId,
      })
      .query(api.tryouts.queries.me.attempt.getUserTryoutAttempt, {
        attemptId: selectedHistoryRow?.attemptId,
        product: "snbt",
        locale: "id",
        tryoutSlug: "attempt-history-selection",
      });

    expect(history.page[0]?.attemptId).toBe(state.latestAttempt);
    expect(history.page[0]?.attemptNumber).toBe(2);
    expect(history.page[0]?.isLatest).toBe(true);
    expect(history.page[1]?.attemptId).toBe(state.olderAttempt);
    expect(history.page[1]?.attemptNumber).toBe(1);
    expect(history.page[1]?.isLatest).toBe(false);
    expect(selectedHistoryRow?.attemptId).toBe(state.olderAttempt);
    expect(selectedHistoryRow?.attemptNumber).toBe(1);
    expect(selectedAttempt?.attempt._id).toBe(state.olderAttempt);
    expect(selectedAttempt?.attempt.attemptNumber).toBe(1);
    expect(selectedAttempt?.attempt.totalCorrect).toBe(4);
  });

  it("keeps paginated history slices stable when the selected attempt is older", async () => {
    const t = createTryoutTestConvex();
    const state = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "attempt-history-filter-selected",
      });
      const tryout = await insertTryoutSkeleton(
        ctx,
        "attempt-history-filter-selected"
      );
      const oldestAttempt = await insertCompletedTryoutAttempt(ctx, {
        scaleVersionId: tryout.scaleVersionId,
        setId: tryout.setId,
        slug: "attempt-history-filter-selected-oldest",
        tryoutId: tryout.tryoutId,
        userId: identity.userId,
      });
      const middleAttempt = await insertCompletedTryoutAttempt(ctx, {
        scaleVersionId: tryout.scaleVersionId,
        setId: tryout.setId,
        slug: "attempt-history-filter-selected-middle",
        tryoutId: tryout.tryoutId,
        userId: identity.userId,
      });
      const latestAttempt = await insertCompletedTryoutAttempt(ctx, {
        scaleVersionId: tryout.scaleVersionId,
        setId: tryout.setId,
        slug: "attempt-history-filter-selected-latest",
        tryoutId: tryout.tryoutId,
        userId: identity.userId,
      });

      await ctx.db.patch("tryoutAttempts", oldestAttempt.tryoutAttemptId, {
        completedAt: NOW,
        lastActivityAt: NOW,
        startedAt: NOW,
      });
      await ctx.db.patch("tryoutAttempts", middleAttempt.tryoutAttemptId, {
        completedAt: NOW + 1,
        lastActivityAt: NOW + 1,
        startedAt: NOW + 1,
      });
      await ctx.db.patch("tryoutAttempts", latestAttempt.tryoutAttemptId, {
        completedAt: NOW + 2,
        lastActivityAt: NOW + 2,
        startedAt: NOW + 2,
      });

      return {
        identity,
        latestAttempt: latestAttempt.tryoutAttemptId,
        middleAttempt: middleAttempt.tryoutAttemptId,
        oldestAttempt: oldestAttempt.tryoutAttemptId,
      };
    });

    const firstPage = await t
      .withIdentity({
        subject: state.identity.authUserId,
        sessionId: state.identity.sessionId,
      })
      .query(api.tryouts.queries.me.history.getUserTryoutAttemptHistory, {
        attemptId: state.oldestAttempt,
        paginationOpts: {
          cursor: null,
          numItems: 2,
        },
        product: "snbt",
        locale: "id",
        tryoutSlug: "attempt-history-filter-selected",
      });

    expect(firstPage.page.map((row) => row.attemptId)).toEqual([
      state.latestAttempt,
      state.middleAttempt,
    ]);
    expect(firstPage.page).toHaveLength(2);
    expect(firstPage.page[0]?.isLatest).toBe(true);
    expect(firstPage.page[1]?.isLatest).toBe(false);

    const secondPage = await t
      .withIdentity({
        subject: state.identity.authUserId,
        sessionId: state.identity.sessionId,
      })
      .query(api.tryouts.queries.me.history.getUserTryoutAttemptHistory, {
        attemptId: state.oldestAttempt,
        paginationOpts: {
          cursor: firstPage.continueCursor,
          numItems: 2,
        },
        product: "snbt",
        locale: "id",
        tryoutSlug: "attempt-history-filter-selected",
      });

    expect(secondPage.page.map((row) => row.attemptId)).toEqual([
      state.oldestAttempt,
    ]);
    expect(secondPage.isDone).toBe(true);
  });
});
