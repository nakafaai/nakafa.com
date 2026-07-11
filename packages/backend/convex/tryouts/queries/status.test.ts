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
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

type StatusArgs = FunctionArgs<typeof api.tryouts.queries.sets.byStatus>;
type UnattemptedArgs = FunctionArgs<
  typeof api.tryouts.queries.sets.unattempted
>;

function getStatusArgs(
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

function getUnattemptedArgs(): UnattemptedArgs {
  return {
    countryKey: "indonesia",
    examKey: "snbt",
    locale: "id",
    paginationOpts: { cursor: null, numItems: 10 },
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

describe("tryouts/queries/sets status filtering", () => {
  it("filters one attempted state before pagination and keeps unattempted separate", async () => {
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
        order: 5,
        status: "in-progress",
        userId: user.userId,
      });
      await insertSet(ctx, {
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
          getStatusArgs("in-progress", cursor, 1)
        );
      inProgressSetKeys.push(...page.page.map((row) => row.setKey));

      if (page.isDone) {
        break;
      }

      cursor = page.continueCursor;
    }
    const completed = await authed.query(
      api.tryouts.queries.sets.byStatus,
      getStatusArgs("completed")
    );
    const expired = await authed.query(
      api.tryouts.queries.sets.byStatus,
      getStatusArgs("expired")
    );
    const unattempted = await authed.query(
      api.tryouts.queries.sets.unattempted,
      getUnattemptedArgs()
    );
    const publicByStatus = await t.query(
      api.tryouts.queries.sets.byStatus,
      getStatusArgs("in-progress")
    );
    const publicUnattempted = await t.query(
      api.tryouts.queries.sets.unattempted,
      getUnattemptedArgs()
    );

    expect(inProgressSetKeys).toEqual(["set-2", "set-5"]);
    expect(completed.page).toMatchObject([
      { attemptStatus: "completed", setKey: "set-3" },
    ]);
    expect(expired.page).toMatchObject([
      { attemptStatus: "expired", setKey: "set-4" },
    ]);
    expect(unattempted.page).toMatchObject([
      { attemptStatus: null, setKey: "set-1" },
    ]);
    expect(publicByStatus.page).toEqual([]);
    expect(publicUnattempted.page).toHaveLength(5);
  });

  it("returns empty status streams for an unavailable track", async () => {
    const t = convexTest(schema, convexModules);

    const byStatus = await t.query(
      api.tryouts.queries.sets.byStatus,
      getStatusArgs("in-progress")
    );
    const unattempted = await t.query(
      api.tryouts.queries.sets.unattempted,
      getUnattemptedArgs()
    );

    expect(byStatus.page).toEqual([]);
    expect(unattempted.page).toEqual([]);
  });
});
