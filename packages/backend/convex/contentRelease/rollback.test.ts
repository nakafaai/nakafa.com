import {
  type RollbackPage,
  RollbackPageSchema,
} from "@nakafa/aksara-contracts/release/rollback";
import {
  type RoutePage,
  RoutePageSchema,
} from "@nakafa/aksara-contracts/release/route-page";
import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
  testRollbackJson,
} from "@repo/backend/test/content-release";
import {
  activateRollbackFixture,
  insertRollbackItem,
  insertRoute,
  rollbackArtifactHash,
} from "@repo/backend/test/content-rollback";
import { insertTestRelease } from "@repo/backend/test/content-stage";
import { convexTest, type TestConvex } from "convex-test";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

const prepareRollback = internal.contentRelease.rollback.prepareRollback;
const prepareRoutes = internal.contentRelease.rollback.prepareRoutes;

/** Decodes the canonical body response through the shared contract. */
function decodePage(source: string): RollbackPage {
  return Schema.decodeUnknownSync(RollbackPageSchema)(JSON.parse(source));
}

/** Decodes the canonical route response through the shared contract. */
function decodeRoutePage(source: string): RoutePage {
  return Schema.decodeUnknownSync(RoutePageSchema)(JSON.parse(source));
}

/** Reads one exact body rollback page from the active technical release. */
function readPage(
  t: TestConvex<typeof schema>,
  afterIndex: number,
  limit: number
) {
  return t
    .query(prepareRollback, {
      afterIndex,
      limit,
      rollbackOf: TEST_RELEASE_ID,
      rollbackOfManifestHash: TEST_MANIFEST_HASH,
    })
    .then(decodePage);
}

/** Reads one exact route rollback page from the active technical release. */
function readRoutes(
  t: TestConvex<typeof schema>,
  afterIndex: number,
  limit: number
) {
  return t
    .query(prepareRoutes, {
      afterIndex,
      limit,
      rollbackOf: TEST_RELEASE_ID,
      rollbackOfManifestHash: TEST_MANIFEST_HASH,
    })
    .then(decodeRoutePage);
}

describe("contentRelease/rollback", () => {
  it("returns exact current-to-prior records in bounded pages", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await activateRollbackFixture(ctx, 2);
      await insertRollbackItem(ctx, 0, false);
      await insertRollbackItem(ctx, 1, true);
    });

    const first = await readPage(t, -1, 1);
    const second = await readPage(t, first.nextIndex, 1);

    expect(first).toMatchObject({
      done: false,
      nextIndex: 0,
      records: [
        {
          current: { change: { operation: "upsert" } },
          index: 0,
          prior: { change: { operation: "delete" } },
        },
      ],
      rollbackOfManifestHash: TEST_MANIFEST_HASH,
      total: 2,
    });
    expect(second).toMatchObject({
      done: true,
      nextIndex: 1,
      records: [
        {
          current: { change: { operation: "upsert" } },
          index: 1,
          prior: { change: { operation: "upsert" } },
        },
      ],
      total: 2,
    });
  });

  it("returns exact prior route owners for binds and deletes", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await activateRollbackFixture(ctx, 0, 2);
      await insertRoute(ctx, {
        contentKey: "test:old-a",
        index: 0,
        publicPath: "test/a",
        releaseId: "release-base",
        sequence: 0,
      });
      await insertRoute(ctx, {
        contentKey: "test:old-b",
        index: 1,
        publicPath: "test/b",
        releaseId: "release-base",
        sequence: 0,
      });
      await insertRoute(ctx, {
        contentKey: "test:new-a",
        index: 0,
        publicPath: "test/a",
      });
      await insertRoute(ctx, {
        contentKey: "test:old-b",
        index: 1,
        operation: "delete",
        publicPath: "test/b",
      });
    });

    await expect(readRoutes(t, -1, 2)).resolves.toMatchObject({
      done: true,
      records: [
        { priorContentKey: "test:old-a" },
        { priorContentKey: "test:old-b" },
      ],
      total: 2,
    });
  });

  it("rejects invalid identity, unreadable state, and cursor drift", async () => {
    const invalid = convexTest(schema, convexModules);
    await expect(
      invalid.query(prepareRollback, {
        afterIndex: -2,
        limit: 0,
        rollbackOf: TEST_RELEASE_ID,
        rollbackOfManifestHash: "wrong",
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_LIMIT" } });

    const inactive = convexTest(schema, convexModules);
    await inactive.mutation((ctx) => insertTestRelease(ctx));
    await expect(readPage(inactive, -1, 1)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STATE" },
    });

    const cursor = convexTest(schema, convexModules);
    await cursor.mutation((ctx) => activateRollbackFixture(ctx, 1));
    await expect(readPage(cursor, 1, 1)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_CONFLICT" },
    });
    await expect(readRoutes(cursor, 1, 1)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_CONFLICT" },
    });
  });

  it("rejects tampered snapshots, missing artifacts, and sequence gaps", async () => {
    const tampered = convexTest(schema, convexModules);
    await tampered.mutation(async (ctx) => {
      await activateRollbackFixture(ctx, 1);
      await insertRollbackItem(ctx, 0, true);
      const item = await ctx.db.query("contentItems").unique();
      if (!item) {
        throw new Error("Expected rollback item.");
      }
      await ctx.db.patch("contentItems", item._id, {
        rollbackJson: testRollbackJson({ contentKey: "test:other" }),
      });
    });
    await expect(readPage(tampered, -1, 1)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const missing = convexTest(schema, convexModules);
    await missing.mutation(async (ctx) => {
      await activateRollbackFixture(ctx, 1);
      await insertRollbackItem(ctx, 0, true);
      const prior = await ctx.db
        .query("contentArtifacts")
        .withIndex("by_artifactHash", (query) =>
          query.eq("artifactHash", rollbackArtifactHash(0, "prior"))
        )
        .unique();
      if (!prior) {
        throw new Error("Expected prior artifact.");
      }
      await ctx.db.delete("contentArtifacts", prior._id);
    });
    await expect(readPage(missing, -1, 1)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_MISSING" },
    });

    const gap = convexTest(schema, convexModules);
    await gap.mutation(async (ctx) => {
      await activateRollbackFixture(ctx, 2);
      await insertRollbackItem(ctx, 1, false);
    });
    await expect(readPage(gap, -1, 1)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("stops before body records exceed the transport ceiling", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await activateRollbackFixture(ctx, 8);
      for (let index = 0; index < 8; index += 1) {
        await insertRollbackItem(ctx, index, true, "x".repeat(700_000));
      }
    });

    const page = await readPage(t, -1, 8);
    expect(page.done).toBe(false);
    expect(page.records.length).toBeGreaterThan(0);
    expect(page.records.length).toBeLessThan(8);
  });

  it("rejects a first record that cannot advance the bounded page", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await activateRollbackFixture(ctx, 1);
      await insertRollbackItem(ctx, 0, true, "x".repeat(2_100_000));
    });

    await expect(readPage(t, -1, 1)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
  });

  it("returns canonical terminal pages for an empty active release", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => activateRollbackFixture(ctx, 0, 0));

    await expect(readPage(t, -1, 1)).resolves.toEqual({
      done: true,
      nextIndex: -1,
      records: [],
      rollbackOf: TEST_RELEASE_ID,
      rollbackOfManifestHash: TEST_MANIFEST_HASH,
      total: 0,
    });
    await expect(readRoutes(t, -1, 1)).resolves.toEqual({
      done: true,
      nextIndex: -1,
      records: [],
      rollbackOf: TEST_RELEASE_ID,
      rollbackOfManifestHash: TEST_MANIFEST_HASH,
      total: 0,
    });
  });
});
