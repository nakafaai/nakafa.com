import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_DIGEST,
  TEST_RELEASE_ID,
  testDeleteJson,
  testProjectionJson,
  testRollbackJson,
  testUpsertJson,
} from "@repo/backend/test/content-release";
import { insertTestRelease } from "@repo/backend/test/content-stage";
import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, it } from "vitest";

const stageItems = internal.contentRelease.items.stageItemBatch;
const stageProjections = internal.contentRelease.items.stageProjectionBatch;

/** Stages the exact technical upsert required by projection tests. */
function stageUpsert(t: TestConvex<typeof schema>) {
  return t.mutation(stageItems, {
    batchIndex: 0,
    itemJson: [testUpsertJson()],
    releaseId: TEST_RELEASE_ID,
  });
}

/** Runs one projection batch through its registered mutation. */
function stage(
  t: TestConvex<typeof schema>,
  projectionJson: string[],
  batchIndex = 0
) {
  return t.mutation(stageProjections, {
    batchIndex,
    projectionJson,
    releaseId: TEST_RELEASE_ID,
  });
}

/** Inserts a staged delete item that may never receive a projection. */
function insertDeleteItem(ctx: MutationCtx) {
  return ctx.db.insert("contentItems", {
    artifactReady: false,
    contentKey: "test:head-0",
    index: 0,
    itemBatchHash: TEST_DIGEST,
    itemBatchIndex: 0,
    itemJson: testDeleteJson({ contentKey: "test:head-0" }),
    locale: "en",
    projectionReady: false,
    releaseId: TEST_RELEASE_ID,
    rollbackJson: testRollbackJson(),
    sequence: 1,
    stagedAt: 1,
  });
}

describe("contentRelease/projection", () => {
  it("stages one exact projection and replays its immutable batch", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => insertTestRelease(ctx));
    await stageUpsert(t);

    const created = await stage(t, [testProjectionJson()]);
    const repeated = await stage(t, [testProjectionJson()]);
    const state = await t.run(async (ctx) => ({
      item: await ctx.db.query("contentItems").unique(),
      release: await ctx.db.query("contentReleases").unique(),
    }));

    expect(created).toMatchObject({ created: 1, unchanged: 0 });
    expect(repeated).toMatchObject({ created: 0, unchanged: 1 });
    expect(state.item).toMatchObject({
      projectionJson: testProjectionJson(),
      projectionReady: true,
    });
    expect(state.release?.stagedProjections).toBe(1);
  });

  it("allows the projection to own its canonical route path", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => insertTestRelease(ctx));
    await stageUpsert(t);
    const projectionJson = testProjectionJson({
      publicPath: "test/new-canonical-path",
    });

    await expect(stage(t, [projectionJson])).resolves.toMatchObject({
      created: 1,
    });
    await expect(
      t.run((ctx) => ctx.db.query("contentItems").unique())
    ).resolves.toMatchObject({ projectionJson });
  });

  it("rejects malformed, duplicate, and count-exceeding batches", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => insertTestRelease(ctx));
    await stageUpsert(t);
    await expect(stage(t, [])).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
    await expect(stage(t, ["not-json"])).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
    await expect(stage(t, [testProjectionJson()], -1)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
    await expect(
      stage(t, [testProjectionJson(), testProjectionJson()])
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } });

    const count = convexTest(schema, convexModules);
    await count.mutation((ctx) =>
      insertTestRelease(ctx, { projectionCount: 0 })
    );
    await stageUpsert(count);
    await expect(stage(count, [testProjectionJson()])).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects missing, deleted, and already-owned projection identities", async () => {
    const missing = convexTest(schema, convexModules);
    await missing.mutation((ctx) => insertTestRelease(ctx));
    await expect(stage(missing, [testProjectionJson()])).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_MISSING" },
    });

    const deleted = convexTest(schema, convexModules);
    await deleted.mutation(async (ctx) => {
      await insertTestRelease(ctx);
      await insertDeleteItem(ctx);
    });
    await expect(stage(deleted, [testProjectionJson()])).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const owned = convexTest(schema, convexModules);
    await owned.mutation((ctx) =>
      insertTestRelease(ctx, { projectionCount: 2 })
    );
    await stageUpsert(owned);
    await stage(owned, [testProjectionJson()]);
    await expect(stage(owned, [testProjectionJson()], 1)).rejects.toMatchObject(
      { data: { code: "CONTENT_RELEASE_CONFLICT" } }
    );
  });

  it("rejects changed retry identity and oversized projected rows", async () => {
    const changed = convexTest(schema, convexModules);
    await changed.mutation((ctx) =>
      insertTestRelease(ctx, { projectionCount: 2 })
    );
    await stageUpsert(changed);
    await stage(changed, [testProjectionJson()]);
    await expect(
      stage(changed, [testProjectionJson({ publicPath: "test/changed" })], 0)
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } });

    const oversized = convexTest(schema, convexModules);
    await oversized.mutation((ctx) => insertTestRelease(ctx));
    await stageUpsert(oversized);
    await expect(
      stage(oversized, [testProjectionJson({ title: "x".repeat(530_000) })])
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_SIZE" } });
  });

  it("rejects projection batches after staging closes", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => insertTestRelease(ctx, { status: "verified" }));
    await expect(stage(t, [testProjectionJson()])).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STATE" },
    });
  });
});
