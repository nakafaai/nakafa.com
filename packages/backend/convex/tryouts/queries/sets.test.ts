import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { getTryoutStatusRank } from "@repo/backend/convex/tryouts/progress";
import { insertTryoutAttempt } from "@repo/backend/test/tryout-runtime";
import {
  activateTryoutStartSource,
  TRYOUT_START_COUNTRY,
  TRYOUT_START_EXAM,
  TRYOUT_START_NOW,
  TRYOUT_START_SET,
  TRYOUT_START_TRACK,
} from "@repo/backend/test/tryout-source";
import { seedTryoutStartSet } from "@repo/backend/test/tryout-start";
import {
  insertTryoutCountry,
  insertTryoutExam,
  insertTryoutQuestionSource,
  insertTryoutSection,
  insertTryoutSet,
  insertTryoutTrack,
  TRYOUT_SOURCE,
  TRYOUT_TEST_NOW,
  TRYOUT_TRACK_PATH,
} from "@repo/backend/test/tryouts";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";

type ListArgs = FunctionArgs<typeof api.tryouts.queries.sets.list>;
type StatusArgs = FunctionArgs<typeof api.tryouts.queries.sets.byStatus>;
type UnattemptedArgs = FunctionArgs<
  typeof api.tryouts.queries.sets.unattempted
>;

/** Creates canonical list arguments with focused pagination overrides. */
function listArgs(
  overrides: {
    cursor?: string | null;
    numItems?: number;
    sort?: ListArgs["sort"];
  } = {}
): ListArgs {
  return {
    countryKey: "indonesia",
    examKey: "snbt",
    locale: "id",
    paginationOpts: {
      cursor: overrides.cursor ?? null,
      numItems: overrides.numItems ?? 10,
    },
    sort: overrides.sort ?? { direction: "asc", field: "order" },
    trackKey: "2027",
  };
}

/** Creates canonical arguments for one exact attempt status. */
function statusArgs(
  status: StatusArgs["status"],
  cursor: string | null = null,
  numItems = 10
): StatusArgs {
  return {
    countryKey: "indonesia",
    examKey: "snbt",
    locale: "id",
    paginationOpts: { cursor, numItems },
    status,
    trackKey: "2027",
  };
}

/** Creates canonical arguments for sets without user progress. */
function unattemptedArgs(): UnattemptedArgs {
  return {
    countryKey: "indonesia",
    examKey: "snbt",
    locale: "id",
    paginationOpts: { cursor: null, numItems: 10 },
    trackKey: "2027",
  };
}

/** Inserts one complete set graph and optional user progress. */
async function insertSetGraph(
  ctx: MutationCtx,
  args: {
    isReady?: boolean;
    order: number;
    questionCount?: number;
    sectionCount?: number;
    status?: StatusArgs["status"];
    userId?: Id<"users">;
  }
) {
  const setKey = `set-${args.order}`;
  const sourcePath = `${TRYOUT_SOURCE}:${setKey}`;
  const questionCount = args.questionCount ?? 1;
  const tryoutSetId = await insertTryoutSet(ctx, {
    isReady: args.isReady,
    order: args.order,
    publicPath: `${TRYOUT_TRACK_PATH}/${setKey}`,
    sectionCount: args.sectionCount,
    setKey,
    title: `Set ${args.order}`,
    totalQuestionCount: questionCount,
  });
  const questionSetId = await insertTryoutQuestionSource(ctx, {
    questionCount,
    setKey,
    sourcePath,
  });
  await insertTryoutSection(ctx, {
    publicPath: `${TRYOUT_TRACK_PATH}/${setKey}/section`,
    questionCount,
    questionSetId,
    questionSourcePath: sourcePath,
    setKey,
    tryoutSetId,
  });

  if (!(args.status && args.userId)) {
    return;
  }

  const attemptId = await insertTryoutAttempt(ctx, {
    scoringStrategy: "raw",
    sectionSnapshots: [],
    status: args.status,
    tryoutSetId,
    userId: args.userId,
  });
  await ctx.db.insert("tryoutSetProgress", {
    attemptNumber: 1,
    countryKey: "indonesia",
    examKey: "snbt",
    latestAttemptId: attemptId,
    locale: "id",
    publishedScore: args.status === "in-progress" ? null : args.order * 10,
    setKey,
    status: args.status,
    statusRank: getTryoutStatusRank(args.status),
    trackKey: "2027",
    tryoutSetId,
    updatedAt: TRYOUT_TEST_NOW,
    userId: args.userId,
  });
}

/** Inserts the ready parent catalog shared by set query tests. */
async function insertReadyParents(ctx: MutationCtx) {
  await insertTryoutCountry(ctx);
  await insertTryoutExam(ctx);
  await insertTryoutTrack(ctx);
}

describe("tryouts/queries/sets", () => {
  it("joins signed sets with progress without filesystem set rows", async () => {
    vi.setSystemTime(new Date(TRYOUT_START_NOW));

    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_START_NOW,
        suffix: "signed-set-list",
      });
      await activateTryoutStartSource(ctx, "visible");
      return user;
    });
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    const args: UnattemptedArgs = {
      countryKey: TRYOUT_START_COUNTRY,
      examKey: TRYOUT_START_EXAM,
      locale: "id",
      paginationOpts: { cursor: null, numItems: 10 },
      trackKey: TRYOUT_START_TRACK,
    };

    const before = await authed.query(
      api.tryouts.queries.sets.unattempted,
      args
    );
    const attempt = await authed.mutation(
      api.tryouts.mutations.attempts.startAttempt,
      {
        countryKey: TRYOUT_START_COUNTRY,
        examKey: TRYOUT_START_EXAM,
        locale: "id",
        setKey: TRYOUT_START_SET,
        trackKey: TRYOUT_START_TRACK,
      }
    );
    const list = await authed.query(api.tryouts.queries.sets.list, {
      ...args,
      sort: { direction: "desc", field: "publishedScore" },
    });
    const inProgress = await authed.query(api.tryouts.queries.sets.byStatus, {
      ...args,
      status: "in-progress",
    });
    const after = await authed.query(
      api.tryouts.queries.sets.unattempted,
      args
    );
    const filesystemRows = await t.query(async (ctx) => ({
      sections: await ctx.db.query("tryoutSections").collect(),
      sets: await ctx.db.query("tryoutSets").collect(),
    }));

    expect(before.page).toMatchObject([
      { attemptStatus: null, setKey: TRYOUT_START_SET },
    ]);
    expect(list.page).toMatchObject([
      {
        attemptStatus: "in-progress",
        publishedScore: null,
        setKey: TRYOUT_START_SET,
      },
    ]);
    expect(inProgress.page).toEqual(list.page);
    expect(after.page).toEqual([]);
    expect(filesystemRows).toEqual({ sections: [], sets: [] });
    expect(attempt.attemptId).toBeDefined();
  });

  it("joins signed sets with legacy progress during additive ownership", async () => {
    vi.setSystemTime(new Date(TRYOUT_START_NOW));

    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_START_NOW,
        suffix: "signed-set-legacy-progress",
      });
      const fixture = await seedTryoutStartSet(ctx, {
        userId: user.userId,
        visibility: "visible",
      });
      const attemptId = await insertTryoutAttempt(ctx, {
        sectionSnapshots: [],
        tryoutSetId: fixture.tryoutSetId,
        userId: user.userId,
      });
      await ctx.db.insert("tryoutSetProgress", {
        attemptNumber: 1,
        countryKey: TRYOUT_START_COUNTRY,
        examKey: TRYOUT_START_EXAM,
        latestAttemptId: attemptId,
        locale: "id",
        publishedScore: null,
        setKey: TRYOUT_START_SET,
        status: "in-progress",
        statusRank: getTryoutStatusRank("in-progress"),
        trackKey: TRYOUT_START_TRACK,
        tryoutSetId: fixture.tryoutSetId,
        updatedAt: TRYOUT_START_NOW,
        userId: user.userId,
      });
      return user;
    });
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    const sets = await authed.query(api.tryouts.queries.sets.list, {
      countryKey: TRYOUT_START_COUNTRY,
      examKey: TRYOUT_START_EXAM,
      locale: "id",
      paginationOpts: { cursor: null, numItems: 10 },
      sort: { direction: "asc", field: "order" },
      trackKey: TRYOUT_START_TRACK,
    });

    expect(sets.page).toMatchObject([
      {
        attemptStatus: "in-progress",
        publishedScore: null,
        setKey: TRYOUT_START_SET,
      },
    ]);
  });

  it("lists only sets whose complete graph is ready", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await insertReadyParents(ctx);
      await insertSetGraph(ctx, { order: 1 });
      await insertSetGraph(ctx, { isReady: false, order: 2 });
      await insertSetGraph(ctx, { order: 3, sectionCount: 2 });
    });

    const page = await t.query(api.tryouts.queries.sets.list, listArgs());

    expect(page.page).toMatchObject([
      { attemptStatus: null, publishedScore: null, setKey: "set-1" },
    ]);
  });

  it("hides sets when their parent track is not ready", async () => {
    const t = createConvexTestWithBetterAuth();

    const identity = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_TEST_NOW,
        suffix: "unready-parent",
      });
      await insertTryoutCountry(ctx);
      await insertTryoutExam(ctx);
      await insertTryoutTrack(ctx, { isReady: false });
      await insertSetGraph(ctx, { order: 1 });

      return user;
    });
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });

    const list = await authed.query(api.tryouts.queries.sets.list, listArgs());
    const byStatus = await authed.query(
      api.tryouts.queries.sets.byStatus,
      statusArgs("in-progress")
    );
    const unattempted = await authed.query(
      api.tryouts.queries.sets.unattempted,
      unattemptedArgs()
    );

    expect(list.page).toEqual([]);
    expect(byStatus.page).toEqual([]);
    expect(unattempted.page).toEqual([]);
  });

  it("sorts before cursor pagination", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await insertReadyParents(ctx);
      await insertSetGraph(ctx, { order: 1 });
      await insertSetGraph(ctx, { order: 2, questionCount: 2 });
    });

    const questionSort: ListArgs["sort"] = {
      direction: "desc",
      field: "readyQuestionCount",
    };
    const firstPage = await t.query(
      api.tryouts.queries.sets.list,
      listArgs({ numItems: 1, sort: questionSort })
    );
    const secondPage = await t.query(
      api.tryouts.queries.sets.list,
      listArgs({
        cursor: firstPage.continueCursor,
        numItems: 1,
        sort: questionSort,
      })
    );
    const titlePage = await t.query(
      api.tryouts.queries.sets.list,
      listArgs({ sort: { direction: "desc", field: "title" } })
    );

    expect(firstPage.page.map((set) => set.setKey)).toEqual(["set-2"]);
    expect(secondPage.page.map((set) => set.setKey)).toEqual(["set-1"]);
    expect(titlePage.page.map((set) => set.setKey)).toEqual(["set-2", "set-1"]);
  });

  it("filters attempted states before pagination and keeps unattempted separate", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_TEST_NOW,
        suffix: "tryout-status-filter",
      });
      await insertReadyParents(ctx);

      const fixtures = [
        [1, undefined],
        [2, "in-progress"],
        [3, "completed"],
        [4, "expired"],
        [5, "in-progress"],
      ] satisfies ReadonlyArray<
        readonly [number, StatusArgs["status"] | undefined]
      >;

      for (const [order, status] of fixtures) {
        await insertSetGraph(ctx, { order, status, userId: user.userId });
      }
      await insertSetGraph(ctx, {
        isReady: false,
        order: 6,
        status: "in-progress",
        userId: user.userId,
      });

      return user;
    });
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    const inProgressSetKeys: string[] = [];
    let cursor: string | null = null;

    for (let pageIndex = 0; pageIndex < 5; pageIndex++) {
      const page: FunctionReturnType<typeof api.tryouts.queries.sets.byStatus> =
        await authed.query(
          api.tryouts.queries.sets.byStatus,
          statusArgs("in-progress", cursor, 1)
        );
      inProgressSetKeys.push(...page.page.map((row) => row.setKey));

      if (page.isDone) {
        break;
      }

      cursor = page.continueCursor;
    }

    const completed = await authed.query(
      api.tryouts.queries.sets.byStatus,
      statusArgs("completed")
    );
    const expired = await authed.query(
      api.tryouts.queries.sets.byStatus,
      statusArgs("expired")
    );
    const unattempted = await authed.query(
      api.tryouts.queries.sets.unattempted,
      unattemptedArgs()
    );
    const anonymous = await t.query(
      api.tryouts.queries.sets.byStatus,
      statusArgs("in-progress")
    );
    const anonymousUnattempted = await t.query(
      api.tryouts.queries.sets.unattempted,
      unattemptedArgs()
    );

    expect(inProgressSetKeys).toEqual(["set-2", "set-5"]);
    expect(completed.page).toMatchObject([
      { attemptStatus: "completed", publishedScore: 30, setKey: "set-3" },
    ]);
    expect(expired.page).toMatchObject([
      { attemptStatus: "expired", publishedScore: 40, setKey: "set-4" },
    ]);
    expect(unattempted.page.map((set) => set.setKey)).toEqual(["set-1"]);
    expect(anonymous.page).toEqual([]);
    expect(anonymousUnattempted.page.map((set) => set.setKey)).toEqual([
      "set-1",
      "set-2",
      "set-3",
      "set-4",
      "set-5",
    ]);
  });
});
