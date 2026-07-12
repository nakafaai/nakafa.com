import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 6, 12, 12, 0, 0);
const SET_PATH = "try-out/indonesia/tka/matematika/set-1";

/** Inserts the active direct-entry set resolved by the history query. */
async function insertHistorySet(ctx: MutationCtx) {
  return await ctx.db.insert("tryoutSets", {
    countryKey: "indonesia",
    examKey: "tka",
    internalEntrySectionKey: "matematika",
    isActive: true,
    isReady: true,
    locale: "id",
    order: 1,
    publicPath: SET_PATH,
    readyQuestionCount: 10,
    readyVisibleSectionCount: 0,
    scoringStrategy: "raw",
    sectionCount: 1,
    setKey: "set-1",
    sourceRevision: "2026",
    syncedAt: NOW,
    title: "Set 1",
    totalQuestionCount: 10,
    trackKey: "matematika",
    visibleSectionCount: 0,
  });
}

/** Inserts one terminal raw attempt and its immutable score snapshot. */
async function insertHistoryAttempt(
  ctx: MutationCtx,
  args: {
    attemptNumber: number;
    publishedScore: number;
    startedAt: number;
    tryoutSetId: Id<"tryoutSets">;
    userId: Id<"users">;
  }
) {
  const attemptId = await ctx.db.insert("tryoutAttempts", {
    attemptNumber: args.attemptNumber,
    completedAt: args.startedAt + 1000,
    completedSectionKeys: [],
    endReason: "submitted",
    expiresAt: args.startedAt + 3_600_000,
    lastActivityAt: args.startedAt + 1000,
    scoreStatus: "official",
    scoringStrategy: "raw",
    sectionSnapshots: [],
    startedAt: args.startedAt,
    status: "completed",
    totalCorrect: args.publishedScore / 10,
    totalQuestions: 10,
    tryoutSetId: args.tryoutSetId,
    userId: args.userId,
  });

  await ctx.db.insert("tryoutScores", {
    finalizedAt: args.startedAt + 1000,
    publishedScore: args.publishedScore,
    rawScore: args.publishedScore,
    scoreStatus: "official",
    scoringStrategy: "raw",
    totalCorrect: args.publishedScore / 10,
    totalQuestions: 10,
    tryoutAttemptId: attemptId,
    tryoutSetId: args.tryoutSetId,
    userId: args.userId,
  });

  return attemptId;
}

describe("tryouts/queries/history", () => {
  it("returns authenticated score snapshots newest first", async () => {
    vi.setSystemTime(new Date(NOW));

    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "tryout-history",
      });
      const tryoutSetId = await insertHistorySet(ctx);
      const firstAttemptId = await insertHistoryAttempt(ctx, {
        attemptNumber: 1,
        publishedScore: 70,
        startedAt: NOW - 20_000,
        tryoutSetId,
        userId: identity.userId,
      });
      const secondAttemptId = await insertHistoryAttempt(ctx, {
        attemptNumber: 2,
        publishedScore: 90,
        startedAt: NOW - 10_000,
        tryoutSetId,
        userId: identity.userId,
      });

      return { firstAttemptId, identity, secondAttemptId };
    });
    const authed = t.withIdentity({
      sessionId: seeded.identity.sessionId,
      subject: seeded.identity.authUserId,
    });

    const history = await authed.query(api.tryouts.queries.history.list, {
      locale: "id",
      paginationOpts: { cursor: null, numItems: 25 },
      publicPath: SET_PATH,
    });

    expect(history.isDone).toBe(true);
    expect(history.page).toEqual([
      expect.objectContaining({
        attemptId: seeded.secondAttemptId,
        attemptNumber: 2,
        score: expect.objectContaining({ publishedScore: 90 }),
        status: "completed",
      }),
      expect.objectContaining({
        attemptId: seeded.firstAttemptId,
        attemptNumber: 1,
        score: expect.objectContaining({ publishedScore: 70 }),
        status: "completed",
      }),
    ]);
  });

  it("returns an empty page when the active set does not exist", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation((ctx) =>
      seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "tryout-history-missing",
      })
    );
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    const history = await authed.query(api.tryouts.queries.history.list, {
      locale: "id",
      paginationOpts: { cursor: null, numItems: 25 },
      publicPath: "try-out/indonesia/tka/matematika/missing",
    });

    expect(history).toEqual({
      continueCursor: "",
      isDone: true,
      page: [],
    });
  });

  it("caps each requested page at twenty-five attempts", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "tryout-history-cap",
      });
      const tryoutSetId = await insertHistorySet(ctx);

      for (let attemptNumber = 1; attemptNumber <= 26; attemptNumber += 1) {
        await insertHistoryAttempt(ctx, {
          attemptNumber,
          publishedScore: attemptNumber,
          startedAt: NOW + attemptNumber,
          tryoutSetId,
          userId: identity.userId,
        });
      }

      return identity;
    });
    const authed = t.withIdentity({
      sessionId: seeded.sessionId,
      subject: seeded.authUserId,
    });

    const history = await authed.query(api.tryouts.queries.history.list, {
      locale: "id",
      paginationOpts: { cursor: null, numItems: 100 },
      publicPath: SET_PATH,
    });

    expect(history.isDone).toBe(false);
    expect(history.page).toHaveLength(25);
    expect(history.page.at(0)?.attemptNumber).toBe(26);
  });
});
