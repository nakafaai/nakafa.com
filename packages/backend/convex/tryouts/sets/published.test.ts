import { api } from "@repo/backend/convex/_generated/api";
import { TRYOUT_CATALOG_LIMIT } from "@repo/backend/convex/contentRelease/tryout/limits";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { getTryoutStatusRank } from "@repo/backend/convex/tryouts/progress/write";
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
import type { FunctionArgs } from "convex/server";
import { describe, expect, it, vi } from "vitest";

type UnattemptedArgs = FunctionArgs<
  typeof api.tryouts.queries.sets.unattempted
>;

describe("tryouts/sets/published", () => {
  it("joins signed sets without reading retired progress", async () => {
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
    await t.mutation(async (ctx) => {
      for (let index = 0; index <= TRYOUT_CATALOG_LIMIT; index += 1) {
        await ctx.db.insert("tryoutSetProgress", {
          attemptNumber: 1,
          countryKey: TRYOUT_START_COUNTRY,
          examKey: TRYOUT_START_EXAM,
          latestAttemptId: attempt.attemptId,
          locale: "id",
          publishedScore: index,
          setKey: `retired-${index}`,
          status: "completed",
          statusRank: getTryoutStatusRank("completed"),
          trackKey: TRYOUT_START_TRACK,
          updatedAt: TRYOUT_START_NOW,
          userId: identity.userId,
        });
      }
    });
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
});
