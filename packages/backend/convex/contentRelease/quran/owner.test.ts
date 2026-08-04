import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { loadQuranOwner } from "@repo/backend/convex/contentRelease/quran/owner";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
  testReleaseJson,
} from "@repo/backend/test/content-release";
import { makeQuranSurah } from "@repo/backend/test/quran-rows";
import {
  activateQuranSnapshot,
  activateQuranSource,
} from "@repo/backend/test/quran-snapshot";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("contentRelease/quran/owner", () => {
  it("preserves the active release while Quran remains source-owned", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(activateQuranSource);

    await expect(
      t.query((ctx) => runConvexProgram(loadQuranOwner(ctx)))
    ).resolves.toEqual({
      activeManifestHash: TEST_MANIFEST_HASH,
      activeReleaseId: TEST_RELEASE_ID,
      managed: false,
      snapshotId: null,
      sourceRevision: null,
    });
  });

  it("tracks an active release change without claiming Quran ownership", async () => {
    const nextReleaseId = ReleaseIdSchema.make("release-next");
    const t = convexTest(schema, convexModules);
    await t.mutation(activateQuranSource);
    await t.mutation(async (ctx) => {
      const [release, state] = await Promise.all([
        ctx.db.query("contentReleases").unique(),
        ctx.db.query("contentState").unique(),
      ]);
      if (!(release && state)) {
        throw new Error("Expected one active source release.");
      }
      await ctx.db.patch("contentReleases", release._id, {
        releaseId: nextReleaseId,
        releaseJson: testReleaseJson({ releaseId: nextReleaseId }),
        sequence: 2,
      });
      await ctx.db.patch("contentState", state._id, {
        activeReleaseId: nextReleaseId,
        activeSequence: 2,
      });
    });

    await expect(
      t.query((ctx) => runConvexProgram(loadQuranOwner(ctx)))
    ).resolves.toMatchObject({
      activeReleaseId: nextReleaseId,
      managed: false,
      snapshotId: null,
    });
  });

  it("selects one approved active Quran snapshot", async () => {
    const empty = convexTest(schema, convexModules);
    await expect(
      empty.query((ctx) => runConvexProgram(loadQuranOwner(ctx)))
    ).resolves.toEqual({
      activeManifestHash: null,
      activeReleaseId: null,
      managed: false,
      snapshotId: null,
      sourceRevision: null,
    });

    const active = convexTest(schema, convexModules);
    const snapshotId = await active.mutation((ctx) =>
      activateQuranSnapshot(ctx, [makeQuranSurah(1)])
    );
    await expect(
      active.query((ctx) => runConvexProgram(loadQuranOwner(ctx)))
    ).resolves.toMatchObject({
      activeReleaseId: TEST_RELEASE_ID,
      managed: true,
      snapshotId,
      sourceRevision: expect.any(String),
    });
  });
});
