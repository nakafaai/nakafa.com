import { assert, describe, expect, it } from "@effect/vitest";
import { advanceModelPage } from "@repo/backend/convex/contentRelease/models/page";
import { decodeReleaseJson } from "@repo/backend/convex/contentRelease/parse";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  CANDIDATE,
  seedVerifiedPair,
} from "@repo/backend/test/activation/fixture";
import { insertModelBuild } from "@repo/backend/test/content/model";
import { convexTest } from "convex-test";
import { Effect } from "effect";

describe("model page advancement", () => {
  it("rejects a completed coordinator before any model writes", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(seedVerifiedPair);
    const build = await t.mutation((ctx) => insertModelBuild(ctx, "ready"));
    await expect(
      t.mutation(async (ctx) => {
        const release = await ctx.db
          .query("contentReleases")
          .withIndex("by_releaseId", (index) =>
            index.eq("releaseId", CANDIDATE.releaseId)
          )
          .unique();
        assert(release);
        return runConvexProgram(
          Effect.gen(function* () {
            const signed = yield* decodeReleaseJson(release.releaseJson);
            return yield* advanceModelPage(ctx, build, release, signed);
          })
        );
      })
    ).rejects.toThrow("cannot advance phase ready");
    expect(
      await t.query((ctx) => ctx.db.query("contentModelBuilds").unique())
    ).toEqual(build);
  });
});
