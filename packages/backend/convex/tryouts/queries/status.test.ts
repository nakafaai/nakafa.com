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
import type { TryoutStatus } from "@repo/backend/convex/tryouts/schema";
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
import type { FunctionArgs } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

type StatusArgs = FunctionArgs<typeof api.tryouts.queries.sets.attempted>;

function getStatusArgs(
  direction: StatusArgs["direction"],
  cursor: string | null = null,
  numItems = 10
): StatusArgs {
  return {
    countryKey: "indonesia",
    direction,
    examKey: "snbt",
    locale: "id",
    paginationOpts: { cursor, numItems },
    trackKey: "2027",
  };
}

async function insertSet(
  ctx: MutationCtx,
  args: {
    isReady?: boolean;
    order: number;
    status: TryoutStatus | null;
    userId: Id<"users">;
  }
) {
  const setKey = `set-${args.order}`;
  const sourcePath = `${TRYOUT_SOURCE}:${setKey}`;
  const tryoutSetId = await insertTryoutSet(ctx, {
    isReady: args.isReady,
    order: args.order,
    publicPath: `${TRYOUT_TRACK_PATH}/${setKey}`,
    setKey,
    title: `Set ${args.order}`,
  });
  const questionSetId = await insertTryoutQuestionSource(ctx, {
    setKey,
    sourcePath,
  });
  await insertTryoutSection(ctx, {
    publicPath: `${TRYOUT_TRACK_PATH}/${setKey}/section`,
    questionSetId,
    questionSourcePath: sourcePath,
    setKey,
    tryoutSetId,
  });

  if (!args.status) {
    return;
  }

  const attemptId = await ctx.db.insert("tryoutAttempts", {
    attemptNumber: 1,
    completedAt: null,
    completedSectionKeys: [],
    endReason: null,
    expiresAt: TRYOUT_TEST_NOW + 1000,
    lastActivityAt: TRYOUT_TEST_NOW,
    scoreStatus: "provisional",
    scoringStrategy: "raw",
    sectionSnapshots: [],
    startedAt: TRYOUT_TEST_NOW,
    status: args.status,
    totalCorrect: 0,
    totalQuestions: 1,
    tryoutSetId,
    userId: args.userId,
  });
  await ctx.db.insert("tryoutSetProgress", {
    attemptNumber: 1,
    countryKey: "indonesia",
    examKey: "snbt",
    latestAttemptId: attemptId,
    locale: "id",
    setKey,
    status: args.status,
    statusRank: getTryoutStatusRank(args.status),
    trackKey: "2027",
    tryoutSetId,
    updatedAt: TRYOUT_TEST_NOW,
    userId: args.userId,
  });
}

describe("tryouts/queries/sets status sorting", () => {
  it("sorts attempted states before pagination and keeps unattempted separate", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: TRYOUT_TEST_NOW,
        suffix: "tryout-status-sort",
      });
      await insertTryoutCountry(ctx);
      await insertTryoutExam(ctx);
      await insertTryoutTrack(ctx);
      await insertSet(ctx, { order: 1, status: null, userId: user.userId });
      await insertSet(ctx, {
        order: 2,
        status: "in-progress",
        userId: user.userId,
      });
      await insertSet(ctx, {
        order: 3,
        status: "completed",
        userId: user.userId,
      });
      await insertSet(ctx, {
        order: 4,
        status: "expired",
        userId: user.userId,
      });
      await insertSet(ctx, {
        isReady: false,
        order: 5,
        status: "in-progress",
        userId: user.userId,
      });

      return user;
    });
    const authed = t.withIdentity({
      sessionId: identity.sessionId,
      subject: identity.authUserId,
    });
    const ascendingStatuses: (TryoutStatus | null)[] = [];
    let cursor: string | null = null;

    for (let pageIndex = 0; pageIndex < 5; pageIndex++) {
      const page = await authed.query(
        api.tryouts.queries.sets.attempted,
        getStatusArgs("asc", cursor, 1)
      );
      ascendingStatuses.push(...page.page.map((row) => row.attemptStatus));

      if (page.isDone) {
        break;
      }

      cursor = page.continueCursor;
    }
    const descending = await authed.query(
      api.tryouts.queries.sets.attempted,
      getStatusArgs("desc")
    );
    const unattempted = await authed.query(
      api.tryouts.queries.sets.unattempted,
      getStatusArgs("asc")
    );
    const publicAttempted = await t.query(
      api.tryouts.queries.sets.attempted,
      getStatusArgs("asc")
    );
    const publicUnattempted = await t.query(
      api.tryouts.queries.sets.unattempted,
      getStatusArgs("asc")
    );

    expect(ascendingStatuses).toEqual(["in-progress", "completed", "expired"]);
    expect(descending.page.map((row) => row.attemptStatus)).toEqual([
      "expired",
      "completed",
      "in-progress",
    ]);
    expect(unattempted.page).toMatchObject([
      { attemptStatus: null, setKey: "set-1" },
    ]);
    expect(publicAttempted.page).toEqual([]);
    expect(publicUnattempted.page).toHaveLength(4);
  });

  it("returns empty status streams for an unavailable track", async () => {
    const t = convexTest(schema, convexModules);

    const attempted = await t.query(
      api.tryouts.queries.sets.attempted,
      getStatusArgs("asc")
    );
    const unattempted = await t.query(
      api.tryouts.queries.sets.unattempted,
      getStatusArgs("asc")
    );

    expect(attempted.page).toEqual([]);
    expect(unattempted.page).toEqual([]);
  });
});
