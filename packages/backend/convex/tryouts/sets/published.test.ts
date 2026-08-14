import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { tryoutCatalogNodeIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import { api } from "@repo/backend/convex/_generated/api";
import { TRYOUT_CATALOG_LIMIT } from "@repo/backend/convex/contentRelease/tryout/limits";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { getTryoutStatusRank } from "@repo/backend/convex/tryouts/status";
import {
  activateTryoutStartSource,
  TRYOUT_START_COUNTRY,
  TRYOUT_START_EXAM,
  TRYOUT_START_NOW,
  TRYOUT_START_SET,
  TRYOUT_START_TRACK,
} from "@repo/backend/test/tryout-source";
import type { FunctionArgs } from "convex/server";
import { describe, expect, it, vi } from "vitest";

type UnattemptedArgs = FunctionArgs<
  typeof api.tryouts.queries.sets.unattempted
>;

describe("tryouts/sets/published", () => {
  it("joins signed sets without exposing unpublished progress", async () => {
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
          appLocale: "id",
          publishedScore: index,
          setIdentity: tryoutCatalogNodeIdentity({
            appLocale: AppLocaleSchema.make("id"),
            countryKey: TRYOUT_START_COUNTRY,
            examKey: TRYOUT_START_EXAM,
            kind: "set",
            setKey: `retired-${index}`,
            trackKey: TRYOUT_START_TRACK,
          }),
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
    expect(attempt.attemptId).toBeDefined();
  });
});
