import { describe, expect, it } from "@effect/vitest";
import {
  MAX_ARTIFACT_BATCH_BYTES,
  MAX_ARTIFACT_BATCH_COUNT,
} from "@nakafa/aksara-contracts/transport/limits";
import { READ_MODEL_DOCUMENT_LIMIT } from "@repo/backend/confect/contentRelease/document";
import {
  TRANSACTION_READ_HEADROOM,
  TRANSACTION_READ_LIMIT,
} from "@repo/backend/confect/contentRelease/spec";
import { convexModules } from "@repo/backend/confect/test.setup";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import {
  insertTestArtifact,
  testArtifactJson,
} from "@repo/backend/test/content/artifact";
import { testProjectionJson } from "@repo/backend/test/content/material";
import {
  TEST_ARTIFACT_HASH,
  TEST_RELEASE_ID,
  testDeleteJson,
  testRollbackJson,
  testTextHash,
  testUpsertJson,
} from "@repo/backend/test/content/release";
import { insertTestRelease } from "@repo/backend/test/content/stage";
import { getConvexSize } from "convex/values";
import { convexTest, type TestConvex } from "convex-test";

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
    artifactLocale: "en",
    projectionJson: testProjectionJson(),
    projectionReady: true,
    releaseId: TEST_RELEASE_ID,
    rollbackJson: testRollbackJson(),
    sequence: 1,
    stagedAt: 1,
  });
}

/** Names one distinct artifact identity inside a full batch. */
function batchArtifactHash(index: number) {
  return testTextHash(`artifact-${index}`);
}

/** Measures one batch exactly as the staging transport contract does. */
function batchSize(artifactJson: string[]) {
  return getConvexSize({
    artifactJson,
    batchIndex: 0,
    releaseId: TEST_RELEASE_ID,
  });
}

/** Builds the largest artifact batch the Aksara transport contract accepts. */
function largestBatch() {
  const batch = (codeLength: number) =>
    Array.from({ length: MAX_ARTIFACT_BATCH_COUNT }, (_, index) =>
      testArtifactJson({
        artifactHash: batchArtifactHash(index),
        compiledCode: "x".repeat(codeLength),
        contentKey: `test:head-${index}`,
      })
    );
  // With five-digit code lengths, every extra code byte adds one wire byte.
  const base = 10_000;
  const spare = MAX_ARTIFACT_BATCH_BYTES - batchSize(batch(base));
  return batch(base + Math.floor(spare / MAX_ARTIFACT_BATCH_COUNT));
}

/** Pads one projection to the read-model ceiling that verified heads keep. */
function ceilingProjectionJson(index: number) {
  const title = "T".repeat(
    READ_MODEL_DOCUMENT_LIMIT - testProjectionJson({ index }).length
  );
  return testProjectionJson({ index, title });
}

/** Inserts one staged upsert that expects the batch artifact at an index. */
function insertBatchItem(
  ctx: MutationCtx,
  index: number,
  projectionJson: string
) {
  const artifactHash = batchArtifactHash(index);
  return ctx.db.insert("contentItems", {
    artifactHash,
    artifactLocale: "en",
    artifactReady: false,
    contentKey: `test:head-${index}`,
    index,
    itemBatchHash: TEST_ARTIFACT_HASH,
    itemBatchIndex: 0,
    itemJson: testUpsertJson({ artifactHash, index }),
    projectionJson,
    projectionReady: true,
    releaseId: TEST_RELEASE_ID,
    rollbackJson: testRollbackJson({ index }),
    sequence: 1,
    stagedAt: 1,
  });
}

type StoreArtifact = (
  ctx: MutationCtx,
  artifactHash: string,
  artifactJson: string
) => Promise<unknown>;

/** Stores one artifact the way current staging does. */
const storeWithFacts: StoreArtifact = (ctx, artifactHash, artifactJson) =>
  insertTestArtifact(ctx, { artifactHash, artifactJson, retainUntil: 1 });

/** Stores one artifact the way staging did before artifact facts. */
const storeBeforeFacts: StoreArtifact = (ctx, artifactHash, artifactJson) =>
  ctx.db.insert("contentArtifacts", {
    artifactHash,
    artifactJson,
    createdAt: 1,
    retainUntil: 1,
  });

/** Seeds one full staged batch whose artifacts are all stored already. */
async function seedReusedBatch(
  t: TestConvex<typeof schema>,
  artifactJson: readonly string[],
  store: StoreArtifact,
  projectionJson: (index: number) => string
) {
  await t.mutation(async (ctx) => {
    await insertTestRelease(ctx, {
      itemCount: MAX_ARTIFACT_BATCH_COUNT,
      stagedUpserts: MAX_ARTIFACT_BATCH_COUNT,
    });
    for (const [index, json] of artifactJson.entries()) {
      await insertBatchItem(ctx, index, projectionJson(index));
      await store(ctx, batchArtifactHash(index), json);
    }
  });
}

/** Stages one batch through its registered mutation and measures its reads. */
function stageMeasured(t: TestConvex<typeof schema>, artifactJson: string[]) {
  return t.mutation(async (ctx) => ({
    receipt: await ctx.runMutation(stageArtifacts, {
      artifactJson,
      batchIndex: 0,
      releaseId: TEST_RELEASE_ID,
    }),
    metrics: await ctx.meta.getTransactionMetrics(),
  }));
}

describe("contentRelease/artifacts", () => {
  it("stages one rollback artifact and replays its exact batch", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      insertTestRelease(ctx, { originReleaseId: "release-base" })
    );
    await stageItem(t);
    const staged = await t.run((ctx) => ctx.db.query("contentItems").unique());

    const created = await stage(t, [testArtifactJson()]);
    const repeated = await stage(t, [testArtifactJson()]);
    const state = await t.run(async (ctx) => ({
      artifact: await ctx.db.query("contentArtifacts").unique(),
      facts: await ctx.db.query("contentArtifactFacts").unique(),
      item: await ctx.db.query("contentItems").unique(),
      release: await ctx.db.query("contentReleases").unique(),
    }));

    expect(created).toMatchObject({ created: 1, unchanged: 0 });
    expect(repeated).toMatchObject({ created: 0, unchanged: 1 });
    expect(state.artifact).toEqual({
      _creationTime: expect.any(Number),
      _id: expect.any(String),
      artifactHash: TEST_ARTIFACT_HASH,
      artifactJson: testArtifactJson(),
    });
    expect(state.facts).toEqual({
      _creationTime: expect.any(Number),
      _id: expect.any(String),
      artifactHash: TEST_ARTIFACT_HASH,
      artifactId: state.artifact?._id,
      artifactJsonHash: testTextHash(testArtifactJson()),
      retainUntil: expect.any(Number),
    });
    expect(state.facts?.retainUntil).toBeGreaterThan(Date.now());
    expect(state.item).toEqual({
      ...staged,
      artifactBatchHash: expect.any(String),
      artifactBatchIndex: 0,
      artifactReady: true,
    });
    expect(state.release?.stagedArtifacts).toBe(1);
  });

  it.each([
    ["artifact facts", storeWithFacts],
    ["a body stored before facts", storeBeforeFacts],
  ] as const)(
    "reuses identical bytes proven by %s without rewriting stored rows",
    async (_, store) => {
      const t = convexTest(schema, convexModules);
      await t.mutation(async (ctx) => {
        await insertTestRelease(ctx);
        await store(ctx, TEST_ARTIFACT_HASH, testArtifactJson());
      });
      await stageItem(t);
      const snapshot = () =>
        t.run(async (ctx) => ({
          artifacts: await ctx.db.query("contentArtifacts").collect(),
          facts: await ctx.db.query("contentArtifactFacts").collect(),
        }));
      const stored = await snapshot();

      const receipt = await stage(t, [testArtifactJson()]);

      expect(receipt).toMatchObject({ created: 0, unchanged: 1 });
      await expect(snapshot()).resolves.toEqual(stored);
    }
  );

  it.each([
    ["artifact facts", storeWithFacts],
    ["bodies stored before facts", storeBeforeFacts],
  ] as const)(
    "stages the largest batch reused through %s well under the transaction read limit",
    async (_, store) => {
      const t = convexTest(schema, convexModules);
      const artifactJson = largestBatch();
      await seedReusedBatch(t, artifactJson, store, ceilingProjectionJson);

      const { metrics, receipt } = await stageMeasured(t, artifactJson);

      expect(batchSize(artifactJson)).toBeGreaterThan(
        MAX_ARTIFACT_BATCH_BYTES - MAX_ARTIFACT_BATCH_COUNT
      );
      expect(receipt).toMatchObject({
        created: 0,
        unchanged: MAX_ARTIFACT_BATCH_COUNT,
      });
      expect(metrics.bytesRead.used).toBeLessThanOrEqual(
        TRANSACTION_READ_LIMIT - TRANSACTION_READ_HEADROOM
      );
    }
  );

  it("reuses a full batch from artifact facts without reading stored bodies", async () => {
    const t = convexTest(schema, convexModules);
    const artifactJson = largestBatch();
    await seedReusedBatch(t, artifactJson, storeWithFacts, (index) =>
      testProjectionJson({ index })
    );

    const { metrics, receipt } = await stageMeasured(t, artifactJson);

    expect(receipt).toMatchObject({
      created: 0,
      unchanged: MAX_ARTIFACT_BATCH_COUNT,
    });
    // The stored bodies alone hold the batch's four mebibytes.
    expect(metrics.bytesRead.used).toBeLessThan(MAX_ARTIFACT_BATCH_BYTES / 4);
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
    for (const store of [storeWithFacts, storeBeforeFacts]) {
      const reused = convexTest(schema, convexModules);
      await reused.mutation(async (ctx) => {
        await insertTestRelease(ctx);
        await store(
          ctx,
          TEST_ARTIFACT_HASH,
          testArtifactJson({ plainText: "different" })
        );
      });
      await stageItem(reused);
      await expect(stage(reused, [testArtifactJson()])).rejects.toMatchObject({
        data: { code: "CONTENT_RELEASE_CONFLICT" },
      });
    }

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
