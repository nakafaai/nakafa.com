import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { testArtifactJson } from "@repo/backend/test/content-artifact";
import {
  insertTestRelease,
  TEST_ARTIFACT_HASH,
  TEST_RELEASE_ID,
  testDeleteJson,
  testProjectionJson,
  testRollbackJson,
  testUpsertJson,
} from "@repo/backend/test/content-release";
import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, it } from "vitest";

const stageItems = internal.contentRelease.items.stageItemBatch;
const stageArtifacts = internal.contentRelease.artifacts.stageArtifactBatch;

/** Stages one technical upsert before its immutable artifact. */
function stageItem(t: TestConvex<typeof schema>) {
  return t.mutation(stageItems, {
    batchIndex: 0,
    itemJson: [testUpsertJson()],
    releaseId: TEST_RELEASE_ID,
  });
}

/** Runs one artifact batch through its registered mutation. */
function stage(
  t: TestConvex<typeof schema>,
  artifactJson: string[],
  batchIndex = 0
) {
  return t.mutation(stageArtifacts, {
    artifactJson,
    batchIndex,
    releaseId: TEST_RELEASE_ID,
  });
}

/** Inserts one staged delete that may never receive an artifact. */
function insertDeleteItem(ctx: MutationCtx) {
  return ctx.db.insert("contentItems", {
    artifactReady: false,
    contentKey: "test:head-0",
    index: 0,
    itemBatchHash: TEST_ARTIFACT_HASH,
    itemBatchIndex: 0,
    itemJson: testDeleteJson({ contentKey: "test:head-0" }),
    locale: "en",
    projectionJson: testProjectionJson(),
    projectionReady: true,
    releaseId: TEST_RELEASE_ID,
    rollbackJson: testRollbackJson(),
    sequence: 1,
    stagedAt: 1,
  });
}

describe("contentRelease/artifacts", () => {
  it("stores one immutable artifact and replays its exact batch", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => insertTestRelease(ctx));
    await stageItem(t);

    const created = await stage(t, [testArtifactJson()]);
    const repeated = await stage(t, [testArtifactJson()]);
    const state = await t.run(async (ctx) => ({
      artifact: await ctx.db.query("contentArtifacts").unique(),
      item: await ctx.db.query("contentItems").unique(),
      release: await ctx.db.query("contentReleases").unique(),
    }));

    expect(created).toMatchObject({ created: 1, unchanged: 0 });
    expect(repeated).toMatchObject({ created: 0, unchanged: 1 });
    expect(state.artifact?.artifactHash).toBe(TEST_ARTIFACT_HASH);
    expect(state.item).toMatchObject({
      artifactBatchIndex: 0,
      artifactReady: true,
    });
    expect(state.release?.stagedArtifacts).toBe(1);
  });

  it("reuses identical stored bytes and only extends shorter retention", async () => {
    for (const retainUntil of [0, Number.MAX_SAFE_INTEGER]) {
      const t = convexTest(schema, convexModules);
      await t.mutation(async (ctx) => {
        await insertTestRelease(ctx);
        await ctx.db.insert("contentArtifacts", {
          artifactHash: TEST_ARTIFACT_HASH,
          artifactJson: testArtifactJson(),
          createdAt: 1,
          retainUntil,
        });
      });
      await stageItem(t);

      const receipt = await stage(t, [testArtifactJson()]);
      const artifact = await t.run((ctx) =>
        ctx.db.query("contentArtifacts").unique()
      );
      expect(receipt).toMatchObject({ created: 0, unchanged: 1 });
      expect(artifact?.retainUntil).toBeGreaterThanOrEqual(retainUntil);
    }
  });

  it("rejects malformed, repeated, oversized, and over-count batches", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => insertTestRelease(ctx));
    await stageItem(t);
    await expect(stage(t, [])).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
    await expect(stage(t, ["not-json"])).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
    await expect(stage(t, [testArtifactJson()], -1)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
    await expect(
      stage(t, [testArtifactJson(), testArtifactJson()])
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } });
    await expect(
      stage(t, [testArtifactJson({ compiledCode: "x".repeat(491_000) })])
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_SIZE" } });

    const count = convexTest(schema, convexModules);
    await count.mutation((ctx) => insertTestRelease(ctx));
    await stageItem(count);
    await count.mutation(async (ctx) => {
      const release = await ctx.db.query("contentReleases").unique();
      if (!release) {
        throw new Error("Expected staged release.");
      }
      await ctx.db.patch("contentReleases", release._id, {
        stagedArtifacts: 1,
      });
    });
    await expect(stage(count, [testArtifactJson()])).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects missing, ready, deleted, and mismatched staged items", async () => {
    const missing = convexTest(schema, convexModules);
    await missing.mutation((ctx) =>
      insertTestRelease(ctx, { stagedUpserts: 1 })
    );
    await expect(stage(missing, [testArtifactJson()])).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_MISSING" },
    });

    const ready = convexTest(schema, convexModules);
    await ready.mutation((ctx) => insertTestRelease(ctx));
    await stageItem(ready);
    await ready.mutation(async (ctx) => {
      const item = await ctx.db.query("contentItems").unique();
      if (!item) {
        throw new Error("Expected staged item.");
      }
      await ctx.db.patch("contentItems", item._id, { artifactReady: true });
    });
    await expect(stage(ready, [testArtifactJson()])).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_CONFLICT" },
    });

    const deleted = convexTest(schema, convexModules);
    await deleted.mutation(async (ctx) => {
      await insertTestRelease(ctx);
      await insertDeleteItem(ctx);
    });
    await expect(stage(deleted, [testArtifactJson()])).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const mismatch = convexTest(schema, convexModules);
    await mismatch.mutation((ctx) => insertTestRelease(ctx));
    await stageItem(mismatch);
    await expect(
      stage(mismatch, [testArtifactJson({ rendererDomain: "chemistry" })])
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });

  it("rejects immutable hash reuse and changed retry identity", async () => {
    const reused = convexTest(schema, convexModules);
    await reused.mutation(async (ctx) => {
      await insertTestRelease(ctx);
      await ctx.db.insert("contentArtifacts", {
        artifactHash: TEST_ARTIFACT_HASH,
        artifactJson: testArtifactJson({ plainText: "different" }),
        createdAt: 1,
        retainUntil: Number.MAX_SAFE_INTEGER,
      });
    });
    await stageItem(reused);
    await expect(stage(reused, [testArtifactJson()])).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_CONFLICT" },
    });

    const changed = convexTest(schema, convexModules);
    await changed.mutation((ctx) => insertTestRelease(ctx));
    await stageItem(changed);
    await stage(changed, [testArtifactJson()]);
    await expect(
      stage(changed, [testArtifactJson({ plainText: "changed" })])
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } });
  });

  it("rejects artifact batches after staging closes", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => insertTestRelease(ctx, { status: "verified" }));
    await expect(stage(t, [testArtifactJson()])).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STATE" },
    });
  });
});
