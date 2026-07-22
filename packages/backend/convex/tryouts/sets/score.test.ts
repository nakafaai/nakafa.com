import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { getTryoutStatusRank } from "@repo/backend/convex/tryouts/progress";
import {
  insertTryoutCountry,
  insertTryoutExam,
  insertTryoutQuestionSource,
  insertTryoutSection,
  insertTryoutSet,
  insertTryoutTrack,
  TRYOUT_SECTION_KEY,
  TRYOUT_SOURCE,
  TRYOUT_TEST_NOW,
  TRYOUT_TRACK_PATH,
} from "@repo/backend/test/tryouts";
import type { FunctionArgs } from "convex/server";
import { describe, expect, it } from "vitest";

type SetListArgs = FunctionArgs<typeof api.tryouts.queries.sets.list>;

interface ReadySet {
  readonly questionSetId: Id<"questionSets">;
  readonly sectionId: Id<"tryoutSections">;
  readonly setId: Id<"tryoutSets">;
  readonly setKey: string;
  readonly sourcePath: string;
}

/** Inserts one ready set and its complete section projection. */
async function insertReadySet(
  ctx: MutationCtx,
  args: { order: number; setKey: string }
): Promise<ReadySet> {
  const publicPath = `${TRYOUT_TRACK_PATH}/${args.setKey}`;
  const sourcePath = `${TRYOUT_SOURCE}:${args.setKey}`;
  const setId = await insertTryoutSet(ctx, {
    order: args.order,
    publicPath,
    setKey: args.setKey,
    title: `Set ${args.order}`,
  });
  const questionSetId = await insertTryoutQuestionSource(ctx, {
    setKey: args.setKey,
    sourcePath,
  });
  const sectionId = await insertTryoutSection(ctx, {
    publicPath: `${publicPath}/${TRYOUT_SECTION_KEY}`,
    questionSetId,
    questionSourcePath: sourcePath,
    setKey: args.setKey,
    tryoutSetId: setId,
  });

  return { questionSetId, sectionId, setId, setKey: args.setKey, sourcePath };
}

/** Inserts one valid terminal attempt and latest-progress score projection. */
async function insertScoredProgress(
  ctx: MutationCtx,
  args: {
    attemptNumber: number;
    score: number;
    set: ReadySet;
    userId: Id<"users">;
  }
) {
  const completedAt = TRYOUT_TEST_NOW + args.attemptNumber * 1000;
  const attemptId = await ctx.db.insert("tryoutAttempts", {
    accessEndsAt: TRYOUT_TEST_NOW + 86_400_000,
    accessSourceKind: "free",
    attemptNumber: args.attemptNumber,
    completedAt,
    completedSectionKeys: [TRYOUT_SECTION_KEY],
    countsForCompetition: false,
    endReason: "submitted",
    expiresAt: TRYOUT_TEST_NOW + 86_400_000,
    lastActivityAt: completedAt,
    scoreStatus: "official",
    scoringStrategy: "irt",
    sectionSnapshots: [
      {
        publicPath: `${TRYOUT_TRACK_PATH}/${args.set.setKey}/${TRYOUT_SECTION_KEY}`,
        questionCount: 1,
        questionSetId: args.set.questionSetId,
        questionSourcePath: args.set.sourcePath,
        sectionKey: TRYOUT_SECTION_KEY,
        sectionOrder: 1,
        sourceRevision: "2026",
        timeLimitSeconds: 1800,
        tryoutSectionId: args.set.sectionId,
      },
    ],
    startedAt: TRYOUT_TEST_NOW,
    status: "completed",
    totalCorrect: 1,
    totalQuestions: 1,
    tryoutSetId: args.set.setId,
    userId: args.userId,
  });

  await ctx.db.insert("tryoutScores", {
    finalizedAt: completedAt,
    publishedScore: args.score,
    rawScore: 100,
    scoreStatus: "official",
    scoringStrategy: "irt",
    totalCorrect: 1,
    totalQuestions: 1,
    tryoutAttemptId: attemptId,
    tryoutSetId: args.set.setId,
    userId: args.userId,
  });
  await ctx.db.insert("tryoutSetProgress", {
    attemptNumber: args.attemptNumber,
    countryKey: "indonesia",
    examKey: "snbt",
    latestAttemptId: attemptId,
    locale: "id",
    publishedScore: args.score,
    setKey: args.set.setKey,
    status: "completed",
    statusRank: getTryoutStatusRank("completed"),
    trackKey: "2027",
    tryoutSetId: args.set.setId,
    updatedAt: completedAt,
    userId: args.userId,
  });
}

/** Builds one score-sorted page request. */
function getScoreArgs(
  direction: "asc" | "desc",
  cursor: string | null,
  numItems = 25
): SetListArgs {
  return {
    countryKey: "indonesia",
    examKey: "snbt",
    locale: "id",
    paginationOpts: { cursor, numItems },
    sort: { direction, field: "publishedScore" },
    trackKey: "2027",
  };
}

describe("tryouts/sets/score", () => {
  it("sorts persisted scores globally and appends unscored sets", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_TEST_NOW,
        suffix: "tryout-score-sort",
      });
      await insertTryoutCountry(ctx);
      await insertTryoutExam(ctx);
      await insertTryoutTrack(ctx);
      const high = await insertReadySet(ctx, { order: 1, setKey: "set-1" });
      const low = await insertReadySet(ctx, { order: 2, setKey: "set-2" });
      await insertReadySet(ctx, { order: 3, setKey: "set-3" });

      await insertScoredProgress(ctx, {
        attemptNumber: 1,
        score: 800,
        set: high,
        userId: identity.userId,
      });
      await insertScoredProgress(ctx, {
        attemptNumber: 1,
        score: 300,
        set: low,
        userId: identity.userId,
      });

      return identity;
    });
    const authed = t.withIdentity({
      sessionId: seeded.sessionId,
      subject: seeded.authUserId,
    });
    const anonymousDescending = await t.query(
      api.tryouts.queries.sets.list,
      getScoreArgs("desc", null)
    );
    const ascendingLow = await authed.query(
      api.tryouts.queries.sets.list,
      getScoreArgs("asc", null, 1)
    );
    const ascendingHigh = await authed.query(
      api.tryouts.queries.sets.list,
      getScoreArgs("asc", ascendingLow.continueCursor)
    );
    const ascendingUnscored = await authed.query(
      api.tryouts.queries.sets.list,
      getScoreArgs("asc", ascendingHigh.continueCursor)
    );
    const descendingHigh = await authed.query(
      api.tryouts.queries.sets.list,
      getScoreArgs("desc", null, 1)
    );
    const descendingLow = await authed.query(
      api.tryouts.queries.sets.list,
      getScoreArgs("desc", descendingHigh.continueCursor)
    );
    const descendingUnscored = await authed.query(
      api.tryouts.queries.sets.list,
      getScoreArgs("desc", descendingLow.continueCursor)
    );

    expect(anonymousDescending.page).toMatchObject([
      { publishedScore: null, setKey: "set-1" },
      { publishedScore: null, setKey: "set-2" },
      { publishedScore: null, setKey: "set-3" },
    ]);
    expect(ascendingLow).toMatchObject({
      isDone: false,
      page: [{ publishedScore: 300, setKey: "set-2" }],
    });
    expect(ascendingHigh).toMatchObject({
      isDone: false,
      page: [{ publishedScore: 800, setKey: "set-1" }],
    });
    expect(ascendingUnscored).toMatchObject({
      isDone: true,
      page: [{ publishedScore: null, setKey: "set-3" }],
    });
    expect(descendingHigh.page).toMatchObject([
      { publishedScore: 800, setKey: "set-1" },
    ]);
    expect(descendingLow.page).toMatchObject([
      { publishedScore: 300, setKey: "set-2" },
    ]);
    expect(descendingUnscored.page).toMatchObject([
      { publishedScore: null, setKey: "set-3" },
    ]);
  });

  it("rejects malformed score pagination cursors", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_TEST_NOW,
        suffix: "tryout-score-cursor",
      });
      await insertTryoutCountry(ctx);
      await insertTryoutExam(ctx);
      await insertTryoutTrack(ctx);
      return user;
    });
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    await expect(
      authed.query(
        api.tryouts.queries.sets.list,
        getScoreArgs("asc", "invalid")
      )
    ).rejects.toThrow("score pagination cursor is invalid");
  });
});
