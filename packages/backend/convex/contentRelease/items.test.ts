import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
  testDeleteJson,
  testUpsertJson,
} from "@repo/backend/test/content-release";
import { insertTestRelease } from "@repo/backend/test/content-stage";
import {
  insertRuntimeBinding,
  insertRuntimeVersion,
} from "@repo/backend/test/runtime-head";
import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, it } from "vitest";

const stageItems = internal.contentRelease.items.stageItemBatch;

/** Stages one exact item batch through its registered mutation. */
function stage(
  t: TestConvex<typeof schema>,
  itemJson: string[],
  batchIndex = 0
) {
  return t.mutation(stageItems, {
    batchIndex,
    itemJson,
    releaseId: TEST_RELEASE_ID,
  });
}

/** Adds one immutable prior material version and active sequence pointer. */
async function insertPrior(
  ctx: MutationCtx,
  contentKey = "test:deleted",
  sequence = 1
) {
  const publicPath = `test/${contentKey.slice(5)}`;
  await insertRuntimeVersion(ctx, "public", contentKey, {
    headReleaseId: "release-base",
    headSequence: sequence,
    publicPath,
  });
  await insertRuntimeBinding(ctx, contentKey, {
    bindingReleaseId: "release-base",
    bindingSequence: sequence,
    publicPath,
  });
  const state = await ctx.db.query("contentState").unique();
  if (!state) {
    throw new Error("Expected publication state.");
  }
  await ctx.db.patch("contentState", state._id, {
    activeManifestHash: TEST_MANIFEST_HASH,
    activeReleaseId: "release-base",
    activeSequence: sequence,
  });
}

describe("contentRelease/items", () => {
  it("stages immutable upsert and delete evidence idempotently", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertTestRelease(ctx, {
        deleteCount: 1,
        itemCount: 2,
        projectionCount: 1,
        routeCount: 1,
        sequence: 2,
        upsertCount: 1,
      });
      await insertPrior(ctx);
    });
    const values = [testUpsertJson(), testDeleteJson({ index: 1 })];

    const created = await stage(t, values);
    const repeated = await stage(t, values);
    const state = await t.run(async (ctx) => ({
      items: await ctx.db.query("contentItems").take(3),
      keys: await ctx.db.query("contentKeys").take(3),
      release: await ctx.db.query("contentReleases").unique(),
    }));

    expect(created).toMatchObject({ created: 2, unchanged: 0 });
    expect(repeated).toMatchObject({ created: 0, unchanged: 2 });
    expect(state.items).toHaveLength(2);
    expect(state.keys).toHaveLength(2);
    expect(state.release).toMatchObject({
      stagedDeletes: 1,
      stagedItems: 2,
      stagedUpserts: 1,
    });
    const deleted = state.items.find(
      ({ contentKey }) => contentKey === "test:deleted"
    );
    expect(deleted?.priorSequence).toBe(1);
    expect(JSON.parse(deleted?.rollbackJson ?? "{}")).toMatchObject({
      snapshot: { state: "material" },
    });
  });

  it("captures absent and tombstoned rollback states exactly", async () => {
    const absent = convexTest(schema, convexModules);
    await absent.mutation((ctx) => insertTestRelease(ctx));
    await stage(absent, [testUpsertJson()]);
    const absentItem = await absent.run((ctx) =>
      ctx.db.query("contentItems").unique()
    );
    expect(absentItem?.priorSequence).toBeUndefined();
    expect(JSON.parse(absentItem?.rollbackJson ?? "{}")).toMatchObject({
      snapshot: { state: "absent" },
    });

    const tombstone = convexTest(schema, convexModules);
    await tombstone.mutation(async (ctx) => {
      await insertTestRelease(ctx, { sequence: 3 });
      const state = await ctx.db.query("contentState").unique();
      if (!state) {
        throw new Error("Expected publication state.");
      }
      await ctx.db.patch("contentState", state._id, {
        activeSequence: 2,
      });
      await ctx.db.insert("contentHeads", {
        contentKey: "test:head-0",
        family: "material",
        index: 0,
        locale: "en",
        operation: "delete",
        releaseId: "release-tombstone",
        sequence: 2,
      });
    });
    await stage(tombstone, [testUpsertJson()]);
    const tombstonedItem = await tombstone.run((ctx) =>
      ctx.db.query("contentItems").unique()
    );
    expect(tombstonedItem?.priorSequence).toBe(2);
    expect(JSON.parse(tombstonedItem?.rollbackJson ?? "{}")).toMatchObject({
      snapshot: { state: "absent" },
    });
  });

  it("rejects malformed, out-of-range, and aggregate-count batches", async () => {
    const malformed = convexTest(schema, convexModules);
    await malformed.mutation((ctx) => insertTestRelease(ctx));
    await expect(stage(malformed, [])).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
    await expect(stage(malformed, ["not-json"])).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
    await expect(
      stage(malformed, [testUpsertJson({ releaseId: "release-other" })])
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
    await expect(
      stage(malformed, [testUpsertJson({ index: 1 })])
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });

    const aggregate = convexTest(schema, convexModules);
    await aggregate.mutation((ctx) =>
      insertTestRelease(ctx, {
        deleteCount: 1,
        itemCount: 2,
        projectionCount: 1,
        upsertCount: 1,
      })
    );
    await stage(aggregate, [testUpsertJson()]);
    await expect(
      stage(aggregate, [testUpsertJson({ index: 1 })], 1)
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });

  it("rejects missing deletes and repeated item identities", async () => {
    const missing = convexTest(schema, convexModules);
    await missing.mutation((ctx) =>
      insertTestRelease(ctx, {
        deleteCount: 1,
        projectionCount: 0,
        routeCount: 0,
        upsertCount: 0,
      })
    );
    await expect(stage(missing, [testDeleteJson()])).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_MISSING" },
    });

    const repeated = convexTest(schema, convexModules);
    await repeated.mutation((ctx) =>
      insertTestRelease(ctx, { itemCount: 2, projectionCount: 2 })
    );
    await stage(repeated, [testUpsertJson()]);
    await expect(
      stage(
        repeated,
        [testUpsertJson({ contentKey: "test:head-0", index: 1 })],
        1
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } });
  });

  it("uses the verified candidate sequence as a recovery base", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertTestRelease(ctx, {
        role: "recovery",
        sequence: 3,
      });
      await insertRuntimeVersion(ctx, "public", "test:head-0", {
        headReleaseId: "release-candidate",
        headSequence: 2,
        publicPath: "test/head-0",
      });
      await insertRuntimeBinding(ctx, "test:head-0", {
        bindingReleaseId: "release-candidate",
        bindingSequence: 2,
        publicPath: "test/head-0",
      });
      const state = await ctx.db.query("contentState").unique();
      if (!state) {
        throw new Error("Expected recovery state.");
      }
      await ctx.db.patch("contentState", state._id, {
        candidateSequence: 2,
      });
    });

    await stage(t, [testUpsertJson()]);
    const item = await t.run((ctx) => ctx.db.query("contentItems").unique());
    expect(item?.priorSequence).toBe(2);
    expect(JSON.parse(item?.rollbackJson ?? "{}")).toMatchObject({
      snapshot: { state: "material" },
    });
  });

  it("rejects batches after staging closes", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => insertTestRelease(ctx, { status: "verified" }));
    await expect(stage(t, [testUpsertJson()])).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STATE" },
    });
  });
});
