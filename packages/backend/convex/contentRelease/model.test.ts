import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  ensureState,
  loadExactVersion,
  loadIdentityItem,
  loadItem,
  loadRelease,
  loadRouteBinding,
  loadStaged,
  loadState,
  loadVersion,
  ownsRole,
  stagedBaseSequence,
} from "@repo/backend/convex/contentRelease/model";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_ARTIFACT_HASH,
  TEST_DIGEST,
  TEST_RELEASE_ID,
  testProjectionJson,
  testRollbackJson,
  testRouteJson,
  testUpsertJson,
} from "@repo/backend/test/content-release";
import { insertTestRelease } from "@repo/backend/test/content-stage";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 6, 23, 12);

/** Inserts one complete immutable material version. */
async function insertVersion(
  ctx: MutationCtx,
  sequence: number,
  releaseId: string = TEST_RELEASE_ID
) {
  await ctx.db.insert("contentHeads", {
    artifactHash: TEST_ARTIFACT_HASH,
    compilerConfigHash: TEST_DIGEST,
    contentKey: "test:head-0",
    delivery: "public",
    family: "material",
    index: 0,
    locale: "en",
    operation: "upsert",
    projectionHash: TEST_DIGEST,
    projectionJson: testProjectionJson(),
    releaseId,
    rendererDomain: "mathematics",
    sequence,
    sourceHash: TEST_DIGEST,
    sourcePath: "packages/corpus/test/head-0/en.mdx",
  });
}

/** Inserts one immutable route binding version. */
async function insertBinding(
  ctx: MutationCtx,
  sequence: number,
  releaseId: string = TEST_RELEASE_ID
) {
  await ctx.db.insert("contentBindings", {
    batchHash: TEST_DIGEST,
    batchIndex: 0,
    contentKey: "test:head-0",
    index: 0,
    locale: "en",
    operation: "bind",
    publicPath: "test/head-0",
    releaseId,
    routeJson: testRouteJson({ releaseId }),
    sequence,
  });
}

/** Inserts one immutable staged item. */
async function insertItem(ctx: MutationCtx) {
  await ctx.db.insert("contentItems", {
    artifactHash: TEST_ARTIFACT_HASH,
    artifactBatchHash: TEST_DIGEST,
    artifactBatchIndex: 0,
    artifactReady: true,
    contentKey: "test:head-0",
    index: 0,
    itemBatchHash: TEST_DIGEST,
    itemBatchIndex: 0,
    itemJson: testUpsertJson(),
    locale: "en",
    projectionBatchHash: TEST_DIGEST,
    projectionBatchIndex: 0,
    projectionJson: testProjectionJson(),
    projectionReady: true,
    releaseId: TEST_RELEASE_ID,
    rollbackJson: testRollbackJson(),
    sequence: 1,
    stagedAt: NOW,
  });
}

describe("contentRelease/model", () => {
  it("creates and reuses the singleton state while releases fail visibly", async () => {
    const t = convexTest(schema, convexModules);
    const identities = await t.mutation(async (ctx) => {
      const created = await runConvexProgram(ensureState(ctx));
      const reused = await runConvexProgram(ensureState(ctx));
      const loaded = await runConvexProgram(loadState(ctx));
      return {
        created: created._id,
        loaded: loaded?._id,
        nextSequence: loaded?.nextSequence,
        reused: reused._id,
      };
    });
    expect(identities).toMatchObject({
      created: identities.reused,
      loaded: identities.created,
      nextSequence: 1,
    });
    await expect(
      t.query((ctx) => runConvexProgram(loadRelease(ctx, TEST_RELEASE_ID)))
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_MISSING" } });
  });

  it("requires exact immutable ownership for staged release slots", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => insertTestRelease(ctx));
    const staged = await t.query((ctx) =>
      runConvexProgram(loadStaged(ctx, TEST_RELEASE_ID))
    );
    expect(staged.release.releaseId).toBe(TEST_RELEASE_ID);
    expect(ownsRole(staged.state, "candidate", staged.release)).toBe(true);
    expect(ownsRole(staged.state, "recovery", staged.release)).toBe(false);
    expect(stagedBaseSequence("candidate", staged.state)).toBeUndefined();
    expect(stagedBaseSequence("recovery", staged.state)).toBe(1);

    await t.mutation(async (ctx) => {
      const state = await ctx.db.query("contentState").unique();
      if (!state) {
        throw new Error("Expected publication state.");
      }
      await ctx.db.patch("contentState", state._id, {
        candidateSequence: 2,
      });
    });
    await expect(
      t.query((ctx) => runConvexProgram(loadStaged(ctx, TEST_RELEASE_ID)))
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });
  });

  it("resolves latest and exact versions while duplicate sequence rows fail", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertVersion(ctx, 1, "release-one");
      await insertVersion(ctx, 3, "release-three");
    });
    await expect(
      t.query((ctx) =>
        runConvexProgram(loadVersion(ctx, "test:head-0", "en", 2))
      )
    ).resolves.toMatchObject({ releaseId: "release-one", sequence: 1 });
    await expect(
      t.query((ctx) =>
        runConvexProgram(loadExactVersion(ctx, "test:head-0", "en", 3))
      )
    ).resolves.toMatchObject({ releaseId: "release-three", sequence: 3 });
    await expect(
      t.query((ctx) =>
        runConvexProgram(loadVersion(ctx, "test:missing", "en", 3))
      )
    ).resolves.toBeNull();

    await t.mutation((ctx) => insertVersion(ctx, 3, "release-duplicate"));
    await expect(
      t.query((ctx) =>
        runConvexProgram(loadVersion(ctx, "test:head-0", "en", 3))
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });

  it("resolves route and item indexes without unbounded reads", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertBinding(ctx, 1, "release-one");
      await insertBinding(ctx, 3, "release-three");
      await insertItem(ctx);
    });
    await expect(
      t.query((ctx) =>
        runConvexProgram(loadRouteBinding(ctx, "en", "test/head-0", 2))
      )
    ).resolves.toMatchObject({ releaseId: "release-one", sequence: 1 });
    await expect(
      t.query((ctx) => runConvexProgram(loadItem(ctx, TEST_RELEASE_ID, 0)))
    ).resolves.toMatchObject({ contentKey: "test:head-0" });
    await expect(
      t.query((ctx) =>
        runConvexProgram(
          loadIdentityItem(ctx, TEST_RELEASE_ID, "test:head-0", "en")
        )
      )
    ).resolves.toMatchObject({ index: 0 });

    await t.mutation((ctx) => insertBinding(ctx, 3, "release-duplicate"));
    await expect(
      t.query((ctx) =>
        runConvexProgram(loadRouteBinding(ctx, "en", "test/head-0", 3))
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });
});
