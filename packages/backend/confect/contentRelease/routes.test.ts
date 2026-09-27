import { describe, expect, it } from "@effect/vitest";
import {
  MAX_ROUTE_BATCH_BYTES,
  MAX_ROUTE_BATCH_COUNT,
} from "@nakafa/aksara-contracts/transport/limits";
import { convexModules } from "@repo/backend/confect/test.setup";
import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import {
  TEST_RELEASE_ID,
  testRouteJson,
} from "@repo/backend/test/content/release";
import { insertTestRelease } from "@repo/backend/test/content/stage";
import { stageUpsertFixture } from "@repo/backend/test/content/verify";
import { convexTest } from "convex-test";

const stage = internal.contentRelease.routes.stageRouteBatch;

describe("content release route batches", () => {
  it("replays an exact route batch without counter drift and rejects changed retry bytes", async () => {
    const t = convexTest(schema, convexModules);
    await stageUpsertFixture(t);
    const args = {
      batchIndex: 0,
      releaseId: TEST_RELEASE_ID,
      routeJson: [testRouteJson()],
    };
    expect(await t.mutation(stage, args)).toEqual({
      batchIndex: 0,
      created: 0,
      releaseId: TEST_RELEASE_ID,
      unchanged: 1,
    });
    await expect(
      t.mutation(stage, {
        ...args,
        routeJson: [testRouteJson({ publicPath: "subjects/changed" })],
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } });
    const state = await t.query(async (ctx) => ({
      release: await ctx.db.query("contentReleases").unique(),
      bindings: await ctx.db.query("contentBindings").collect(),
    }));
    expect(state.release).toMatchObject({ stagedRoutes: 1 });
    expect(state.bindings).toHaveLength(1);
  });

  it.each([
    {
      reason: "empty",
      batchIndex: 0,
      routes: [],
      code: "CONTENT_RELEASE_LIMIT",
    },
    {
      reason: "negative index",
      batchIndex: -1,
      routes: [testRouteJson()],
      code: "CONTENT_RELEASE_INTEGRITY",
    },
    {
      reason: "oversized count",
      batchIndex: 0,
      routes: Array.from({ length: MAX_ROUTE_BATCH_COUNT + 1 }, () =>
        testRouteJson()
      ),
      code: "CONTENT_RELEASE_LIMIT",
    },
    {
      reason: "oversized bytes",
      batchIndex: 0,
      routes: ["x".repeat(MAX_ROUTE_BATCH_BYTES)],
      code: "CONTENT_RELEASE_LIMIT",
    },
  ])(
    "rejects $reason before any route is stored",
    async ({ batchIndex, routes, code }) => {
      const t = convexTest(schema, convexModules);
      await t.mutation((ctx) => insertTestRelease(ctx));
      await expect(
        t.mutation(stage, {
          batchIndex,
          releaseId: TEST_RELEASE_ID,
          routeJson: routes,
        })
      ).rejects.toMatchObject({ data: { code } });
      expect(
        await t.query((ctx) => ctx.db.query("contentBindings").collect())
      ).toEqual([]);
    }
  );

  it.each(["closed", "overflow"] as const)(
    "rejects a %s release before route writes",
    async (reason) => {
      const t = convexTest(schema, convexModules);
      await t.mutation((ctx) =>
        insertTestRelease(ctx, {
          status: reason === "closed" ? "verifying" : "staging",
          routeCount: 0,
        })
      );
      await expect(
        t.mutation(stage, {
          batchIndex: 0,
          releaseId: TEST_RELEASE_ID,
          routeJson: [testRouteJson()],
        })
      ).rejects.toMatchObject({
        data: {
          code:
            reason === "closed"
              ? "CONTENT_RELEASE_STATE"
              : "CONTENT_RELEASE_INTEGRITY",
        },
      });
      expect(
        await t.query((ctx) => ctx.db.query("contentBindings").collect())
      ).toEqual([]);
    }
  );
});
