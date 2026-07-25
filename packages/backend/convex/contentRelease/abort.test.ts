import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { abortProgram } from "@repo/backend/convex/contentRelease/abort";
import {
  RELEASE_PAGE_LIMIT,
  ROLLBACK_RETENTION_MS,
} from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  ABORT_BATCH_HASH,
  ABORT_ITEM_COUNT,
  ABORT_RELEASE_ID,
  abortContentKey,
  seedAbortRelease,
} from "@repo/backend/test/content-abort";
import {
  TEST_DIGEST,
  testProjectionJson,
  testTextHash,
} from "@repo/backend/test/content-release";
import {
  insertZeroRelease,
  type TestIdentity,
} from "@repo/backend/test/content-state";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

/** Runs one server-cursor abort page at the native Convex test boundary. */
function abort(ctx: MutationCtx, releaseId = ABORT_RELEASE_ID) {
  return runConvexProgram(abortProgram(ctx, releaseId));
}

describe("contentRelease/abort", () => {
  it("resumes durable deletion and accepts terminal response-loss retries", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await seedAbortRelease(ctx);
      for (let index = 0; index < ABORT_ITEM_COUNT; index += 1) {
        await ctx.db.insert("contentKeys", {
          contentKey: abortContentKey(index),
          createdSequence: 1,
          family: "material",
          locale: "en",
        });
      }
    });

    const first = await t.mutation((ctx) => abort(ctx));
    const completed = await t.mutation((ctx) => abort(ctx));
    const repeated = await t.mutation((ctx) => abort(ctx));
    const stored = await t.run(async (ctx) => ({
      items: await ctx.db.query("contentItems").collect(),
      keys: await ctx.db.query("contentKeys").collect(),
      release: await ctx.db.query("contentReleases").unique(),
      state: await ctx.db.query("contentState").unique(),
    }));

    expect(first).toEqual({
      complete: false,
      processedItems: RELEASE_PAGE_LIMIT,
      releaseId: ABORT_RELEASE_ID,
      totalItems: ABORT_ITEM_COUNT,
    });
    expect(completed).toEqual({
      complete: true,
      processedItems: ABORT_ITEM_COUNT,
      releaseId: ABORT_RELEASE_ID,
      totalItems: ABORT_ITEM_COUNT,
    });
    expect(repeated).toEqual(completed);
    expect(stored.items).toHaveLength(0);
    expect(stored.keys).toHaveLength(0);
    expect(stored.release?.status).toBe("aborted");
    expect(stored.state?.candidateReleaseId).toBeUndefined();
  });

  it("removes staged path ownership before a later sequence can claim it", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await seedAbortRelease(ctx);
      await ctx.db.insert("contentPaths", {
        createdSequence: 1,
        locale: "en",
        publicPath: "test/abandoned",
      });
      await ctx.db.insert("contentBindings", {
        batchHash: ABORT_BATCH_HASH,
        batchIndex: 0,
        contentKey: abortContentKey(0),
        index: 0,
        locale: "en",
        operation: "bind",
        publicPath: "test/abandoned",
        releaseId: ABORT_RELEASE_ID,
        routeJson: "{}",
        sequence: 1,
      });
      const release = await ctx.db.query("contentReleases").unique();
      if (!release) {
        throw new Error("Expected staged abort release.");
      }
      await ctx.db.patch("contentReleases", release._id, { stagedRoutes: 1 });
    });

    let receipt = await t.mutation((ctx) => abort(ctx));
    while (!receipt.complete) {
      receipt = await t.mutation((ctx) => abort(ctx));
    }

    const paths = await t.run((ctx) => ctx.db.query("contentPaths").take(1));
    expect(paths).toEqual([]);
  });

  it("requires recovery abort before candidate abort", async () => {
    const t = convexTest(schema, convexModules);
    const candidate = {
      manifestHash: `sha256:${"1".repeat(64)}`,
      releaseId: ABORT_RELEASE_ID,
      sequence: 1,
    } satisfies TestIdentity;
    const recovery = {
      manifestHash: `sha256:${"b".repeat(64)}`,
      releaseId: "release-abort-recovery",
      sequence: 2,
    } satisfies TestIdentity;
    await t.mutation(seedAbortRelease);
    await t.mutation(async (ctx) => {
      await insertZeroRelease(ctx, {
        ...recovery,
        base: candidate,
        originReleaseId: candidate.releaseId,
        role: "recovery",
        status: "verified",
      });
      const state = await ctx.db.query("contentState").unique();
      if (!state) {
        throw new Error("Expected content state.");
      }
      await ctx.db.patch("contentState", state._id, {
        nextSequence: 3,
        recoveryManifestHash: recovery.manifestHash,
        recoveryReleaseId: recovery.releaseId,
        recoverySequence: recovery.sequence,
      });
    });

    await expect(t.mutation((ctx) => abort(ctx))).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STATE" },
    });
    await expect(
      t.mutation((ctx) => abort(ctx, recovery.releaseId))
    ).resolves.toMatchObject({ complete: true });
    await expect(t.mutation((ctx) => abort(ctx))).resolves.toMatchObject({
      complete: false,
    });
  });

  it("starts artifact retention when abort removes its final reference", async () => {
    const t = convexTest(schema, convexModules);
    const artifactHash = `sha256:${"d".repeat(64)}`;
    await t.mutation(async (ctx) => {
      await seedAbortRelease(ctx);
      const item = await ctx.db
        .query("contentItems")
        .withIndex("by_releaseId_and_index", (query) =>
          query.eq("releaseId", ABORT_RELEASE_ID).eq("index", 0)
        )
        .unique();
      if (!item) {
        throw new Error("Expected staged abort item.");
      }
      await ctx.db.patch("contentItems", item._id, {
        artifactHash,
        artifactReady: true,
      });
      await ctx.db.insert("contentArtifacts", {
        artifactHash,
        artifactJson: "{}",
        createdAt: 0,
        retainUntil: 0,
      });
    });
    const startedAt = Date.now();

    await t.mutation((ctx) => abort(ctx));

    const artifact = await t.run((ctx) =>
      ctx.db.query("contentArtifacts").unique()
    );
    expect(artifact?.retainUntil).toBeGreaterThanOrEqual(
      startedAt + ROLLBACK_RETENTION_MS
    );
  });

  it("preserves the active search entry while discarding a checked head", async () => {
    const t = convexTest(schema, convexModules);
    const contentKey = abortContentKey(0);
    const projectionJson = testProjectionJson({
      contentKey,
      publicPath: "test/abort-0",
    });
    const projectionHash = testTextHash(projectionJson);
    await t.mutation(async (ctx) => {
      await seedAbortRelease(ctx);
      const release = await ctx.db.query("contentReleases").unique();
      if (!release) {
        throw new Error("Expected abort release.");
      }
      await ctx.db.patch("contentReleases", release._id, { checkedItems: 1 });
      await ctx.db.insert("contentHeads", {
        artifactHash: `sha256:${"d".repeat(64)}`,
        compilerConfigHash: TEST_DIGEST,
        contentKey,
        delivery: "public",
        family: "material",
        index: 0,
        locale: "en",
        operation: "upsert",
        projectionHash,
        projectionJson,
        releaseId: ABORT_RELEASE_ID,
        rendererDomain: "mathematics",
        sequence: 1,
        sourceHash: TEST_DIGEST,
        sourcePath: "packages/corpus/test/abort-0/en.mdx",
      });
      await ctx.db.insert("contentIndex", {
        contentKey,
        family: "material",
        locale: "en",
        projectionHash,
        publicPath: "test/abort-0",
        releaseId: "release-before-abort",
        sequence: 0,
        text: "active search entry",
      });
    });

    await t.mutation((ctx) => abort(ctx));
    await t.mutation((ctx) => abort(ctx));
    const stored = await t.run(async (ctx) => ({
      heads: await ctx.db.query("contentHeads").take(1),
      search: await ctx.db.query("contentIndex").take(1),
    }));
    expect(stored.heads).toEqual([]);
    expect(stored.search).toMatchObject([
      { contentKey, releaseId: "release-before-abort" },
    ]);
  });

  it("rejects an active release and corrupted abort progress", async () => {
    const active = convexTest(schema, convexModules);
    const identity = {
      manifestHash: `sha256:${"c".repeat(64)}`,
      releaseId: "release-active",
      sequence: 1,
    } satisfies TestIdentity;
    await active.mutation(async (ctx) => {
      await insertZeroRelease(ctx, {
        ...identity,
        role: "candidate",
        status: "completed",
      });
    });
    await expect(
      active.mutation((ctx) => abort(ctx, identity.releaseId))
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });

    const corrupt = convexTest(schema, convexModules);
    await corrupt.mutation(seedAbortRelease);
    await corrupt.mutation((ctx) => abort(ctx));
    await corrupt.mutation(async (ctx) => {
      const remaining = await ctx.db.query("contentItems").collect();
      for (const item of remaining) {
        await ctx.db.delete("contentItems", item._id);
      }
    });
    await expect(corrupt.mutation((ctx) => abort(ctx))).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("fails closed before completion while directory ownership remains", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await seedAbortRelease(ctx);
      await ctx.db.insert("contentKeys", {
        contentKey: "test:orphaned-directory",
        createdSequence: 1,
        family: "material",
        locale: "en",
      });
    });

    await t.mutation((ctx) => abort(ctx));
    await expect(t.mutation((ctx) => abort(ctx))).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});
