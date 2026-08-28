import { assert, describe, expect, it } from "@effect/vitest";
import { runProgram } from "@repo/backend/convex/contentRelease/compact";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  compactionIdentity,
  insertCompletedRelease,
} from "@repo/backend/test/content/compact";
import { insertTestState } from "@repo/backend/test/content/state";
import { convexTest } from "convex-test";

describe("contentRelease/compact/runtime", () => {
  it("retains a source release until its permanent runtime is removed", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      const releases = Array.from({ length: 5 }, (_, index) =>
        compactionIdentity(index + 1)
      );
      for (const [index, release] of releases.entries()) {
        await insertCompletedRelease(ctx, release, releases[index - 1]);
      }
      const first = releases[0];
      const active = releases[4];
      assert.ok(first && active);
      await insertTestState(ctx, { active, nextSequence: 6 });
      await ctx.db.insert("tryoutRuntimeBundles", {
        bundleHash: `sha256:${"1".repeat(64)}`,
        bundleJson: "{}",
        cleanupReleaseId: active.releaseId,
        createdAt: 0,
        rendererJson: "{}",
        rendererManifestHash: `sha256:${"2".repeat(64)}`,
        snapshotId: `sha256:${"3".repeat(64)}`,
        sourceGitSha: "1".repeat(40),
        sourceManifestHash: `sha256:${"4".repeat(64)}`,
        sourceReleaseId: first.releaseId,
      });
    });

    await expect(
      t.action((ctx) => runConvexProgram(runProgram(ctx)))
    ).resolves.toMatchObject({ complete: true, floor: 1 });
    await expect(
      t.run(async (ctx) =>
        (await ctx.db.query("contentReleases").collect()).map(
          ({ sequence }) => sequence
        )
      )
    ).resolves.toEqual([1, 2, 3, 4, 5]);

    await t.mutation(async (ctx) => {
      const runtime = await ctx.db.query("tryoutRuntimeBundles").unique();
      assert.ok(runtime);
      await ctx.db.delete("tryoutRuntimeBundles", runtime._id);
    });

    await expect(
      t.action((ctx) => runConvexProgram(runProgram(ctx)))
    ).resolves.toMatchObject({ complete: true, floor: 4 });
    await expect(
      t.run(async (ctx) =>
        (await ctx.db.query("contentReleases").collect()).map(
          ({ sequence }) => sequence
        )
      )
    ).resolves.toEqual([4, 5]);
  });
});
