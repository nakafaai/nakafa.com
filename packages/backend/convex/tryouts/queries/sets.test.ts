import { api } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  insertTryoutCountry,
  insertTryoutExam,
  insertTryoutQuestionSource,
  insertTryoutSection,
  insertTryoutSet,
  insertTryoutTrack,
  TRYOUT_SECTION_KEY,
  TRYOUT_SECTION_PATH,
  TRYOUT_SOURCE,
  TRYOUT_TEST_NOW,
  TRYOUT_TRACK_PATH,
} from "@repo/backend/test/tryouts";
import type { FunctionArgs } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

type SetListArgs = FunctionArgs<typeof api.tryouts.queries.sets.list>;

const defaultSort: SetListArgs["sort"] = {
  direction: "asc",
  field: "order",
};

function getListArgs(
  overrides: {
    cursor?: string | null;
    numItems?: number;
    sort?: SetListArgs["sort"];
  } = {}
): SetListArgs {
  return {
    countryKey: "indonesia",
    examKey: "snbt",
    locale: "id",
    paginationOpts: {
      cursor: overrides.cursor ?? null,
      numItems: overrides.numItems ?? 10,
    },
    sort: overrides.sort ?? defaultSort,
    trackKey: "2027",
  };
}

describe("tryouts/queries/sets", () => {
  it("lists only ready sets under a ready track", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await insertTryoutCountry(ctx);
      await insertTryoutExam(ctx);
      await insertTryoutTrack(ctx);
      const setId = await insertTryoutSet(ctx);
      const questionSetId = await insertTryoutQuestionSource(ctx);

      await insertTryoutSection(ctx, {
        publicPath: TRYOUT_SECTION_PATH,
        questionSetId,
        tryoutSetId: setId,
      });
      await insertTryoutSet(ctx, {
        isReady: false,
        publicPath: `${TRYOUT_TRACK_PATH}/set-2`,
        setKey: "set-2",
      });
    });

    const page = await t.query(api.tryouts.queries.sets.list, getListArgs());

    expect(page.page).toMatchObject([{ attemptStatus: null, setKey: "set-1" }]);
  });

  it("hides sets until every section row is synced", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await insertTryoutCountry(ctx);
      await insertTryoutExam(ctx);
      await insertTryoutTrack(ctx);
      const setId = await insertTryoutSet(ctx, {
        sectionCount: 2,
        totalQuestionCount: 2,
      });
      const questionSetId = await insertTryoutQuestionSource(ctx);

      await insertTryoutSection(ctx, {
        publicPath: TRYOUT_SECTION_PATH,
        questionSetId,
        tryoutSetId: setId,
      });
    });

    const page = await t.query(api.tryouts.queries.sets.list, getListArgs());

    expect(page.page).toEqual([]);
  });

  it("hides sets when their parent track is not ready", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await insertTryoutCountry(ctx);
      await insertTryoutExam(ctx);
      await insertTryoutTrack(ctx, { isReady: false });
      await insertTryoutSet(ctx);
    });

    const page = await t.query(api.tryouts.queries.sets.list, getListArgs());

    expect(page).toMatchObject({
      continueCursor: "",
      isDone: true,
      page: [],
    });
  });

  it("sorts the indexed set collection before cursor pagination", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await insertTryoutCountry(ctx);
      await insertTryoutExam(ctx);
      await insertTryoutTrack(ctx);

      const firstSetId = await insertTryoutSet(ctx);
      const firstQuestionSetId = await insertTryoutQuestionSource(ctx);
      await insertTryoutSection(ctx, {
        publicPath: TRYOUT_SECTION_PATH,
        questionSetId: firstQuestionSetId,
        tryoutSetId: firstSetId,
      });

      const secondSource = `${TRYOUT_SOURCE}:set-2`;
      const secondSetId = await insertTryoutSet(ctx, {
        setKey: "set-2",
        totalQuestionCount: 2,
      });
      const secondQuestionSetId = await insertTryoutQuestionSource(ctx, {
        questionCount: 2,
        setKey: "set-2",
        sourcePath: secondSource,
      });
      await insertTryoutSection(ctx, {
        publicPath: `${TRYOUT_TRACK_PATH}/set-2/${TRYOUT_SECTION_KEY}`,
        questionCount: 2,
        questionSetId: secondQuestionSetId,
        questionSourcePath: secondSource,
        setKey: "set-2",
        tryoutSetId: secondSetId,
      });
    });

    const questionSort: SetListArgs["sort"] = {
      direction: "desc",
      field: "readyQuestionCount",
    };
    const firstPage = await t.query(
      api.tryouts.queries.sets.list,
      getListArgs({
        numItems: 1,
        sort: questionSort,
      })
    );
    const secondPage = await t.query(
      api.tryouts.queries.sets.list,
      getListArgs({
        cursor: firstPage.continueCursor,
        numItems: 1,
        sort: questionSort,
      })
    );
    const titlePage = await t.query(
      api.tryouts.queries.sets.list,
      getListArgs({
        sort: { direction: "desc", field: "title" },
      })
    );

    expect(firstPage.page.map((set) => set.setKey)).toEqual(["set-2"]);
    expect(secondPage.page.map((set) => set.setKey)).toEqual(["set-1"]);
    expect(titlePage.page.map((set) => set.setKey)).toEqual(["set-2", "set-1"]);
  });

  it("projects the authenticated user's latest attempt status", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_TEST_NOW,
        suffix: "tryout-set-status",
      });
      await insertTryoutCountry(ctx);
      await insertTryoutExam(ctx);
      await insertTryoutTrack(ctx);
      const setId = await insertTryoutSet(ctx);
      const questionSetId = await insertTryoutQuestionSource(ctx);
      const sectionId = await insertTryoutSection(ctx, {
        publicPath: TRYOUT_SECTION_PATH,
        questionSetId,
        tryoutSetId: setId,
      });

      const attemptId = await ctx.db.insert("tryoutAttempts", {
        attemptNumber: 1,
        completedAt: null,
        completedSectionKeys: [],
        endReason: null,
        expiresAt: TRYOUT_TEST_NOW + 86_400_000,
        lastActivityAt: TRYOUT_TEST_NOW,
        scoreStatus: "provisional",
        scoringStrategy: "irt",
        sectionSnapshots: [
          {
            publicPath: TRYOUT_SECTION_PATH,
            questionCount: 1,
            questionSetId,
            questionSourcePath: TRYOUT_SOURCE,
            sectionKey: TRYOUT_SECTION_KEY,
            sectionOrder: 1,
            sourceRevision: "2026",
            timeLimitSeconds: 1800,
            tryoutSectionId: sectionId,
          },
        ],
        startedAt: TRYOUT_TEST_NOW,
        status: "in-progress",
        totalCorrect: 0,
        totalQuestions: 1,
        tryoutSetId: setId,
        userId: user.userId,
      });
      await ctx.db.insert("tryoutSetProgress", {
        attemptNumber: 1,
        countryKey: "indonesia",
        examKey: "snbt",
        latestAttemptId: attemptId,
        locale: "id",
        setKey: "set-1",
        status: "in-progress",
        statusRank: 1,
        trackKey: "2027",
        tryoutSetId: setId,
        updatedAt: TRYOUT_TEST_NOW,
        userId: user.userId,
      });

      return user;
    });
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    const page = await authed.query(
      api.tryouts.queries.sets.list,
      getListArgs()
    );

    expect(page.page[0]?.attemptStatus).toBe("in-progress");
  });
});
