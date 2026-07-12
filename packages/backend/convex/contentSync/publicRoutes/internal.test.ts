import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import type { FunctionArgs } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

type SyncShard = FunctionArgs<
  typeof internal.contentSync.publicRoutes.internal.syncShards
>["shards"][number];
type SyncRoute = SyncShard["routes"][number];

describe("contentSync/publicRoutes/internal", () => {
  it("creates route shards and exposes compact sync state", async () => {
    const t = convexTest(schema, convexModules);
    const shard = makeShard(7, [makeRoute("materi/matematika", "hash-a")]);

    const result = await t.mutation(
      internal.contentSync.publicRoutes.internal.syncShards,
      { shards: [shard] }
    );
    await t.mutation(internal.contentSync.publicRoutes.internal.saveRootState, {
      hash: "root-hash",
      rowCount: 1,
    });
    const rootState = await t.query(
      internal.contentSync.publicRoutes.internal.getRootState,
      {}
    );
    const shardStates = await t.query(
      internal.contentSync.publicRoutes.internal.listShardStates,
      { paginationOpts: { cursor: null, numItems: 10 } }
    );
    const routes = await t.query(async (ctx) =>
      ctx.db.query("publicRoutes").collect()
    );

    expect(result).toEqual({
      created: 1,
      deleted: 0,
      unchanged: 0,
      updated: 0,
    });
    expect(rootState).toEqual({ hash: "root-hash", rowCount: 1, shard: -1 });
    expect(shardStates.page).toEqual([
      { hash: "shard-7", rowCount: 1, shard: 7 },
    ]);
    expect(routes).toEqual([
      expect.objectContaining({ contentHash: "hash-a", syncShard: 7 }),
    ]);
  });

  it("does not write unchanged route rows", async () => {
    const t = convexTest(schema, convexModules);
    const shard = makeShard(3, [makeRoute("try-out/indonesia", "hash-a")]);

    await t.mutation(internal.contentSync.publicRoutes.internal.syncShards, {
      shards: [shard],
    });
    const result = await t.mutation(
      internal.contentSync.publicRoutes.internal.syncShards,
      { shards: [shard] }
    );

    expect(result).toEqual({
      created: 0,
      deleted: 0,
      unchanged: 1,
      updated: 0,
    });
  });

  it("reconciles only the changed shard", async () => {
    const t = convexTest(schema, convexModules);
    const firstShard = makeShard(1, [
      makeRoute("materi/fisika", "hash-a"),
      makeRoute("materi/kimia", "hash-b"),
    ]);
    const stableShard = makeShard(2, [
      makeRoute("try-out/indonesia", "hash-c"),
    ]);

    await t.mutation(internal.contentSync.publicRoutes.internal.syncShards, {
      shards: [firstShard, stableShard],
    });
    const result = await t.mutation(
      internal.contentSync.publicRoutes.internal.syncShards,
      {
        shards: [makeShard(1, [makeRoute("materi/fisika", "hash-a-updated")])],
      }
    );
    const routes = await t.query(async (ctx) =>
      ctx.db.query("publicRoutes").collect()
    );

    expect(result).toEqual({
      created: 0,
      deleted: 1,
      unchanged: 0,
      updated: 1,
    });
    expect(routes).toHaveLength(2);
    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contentHash: "hash-a-updated",
          publicPath: "materi/fisika",
          syncShard: 1,
        }),
        expect.objectContaining({
          contentHash: "hash-c",
          publicPath: "try-out/indonesia",
          syncShard: 2,
        }),
      ])
    );
  });

  it("removes state when a shard becomes empty", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(internal.contentSync.publicRoutes.internal.syncShards, {
      shards: [makeShard(5, [makeRoute("materi/biologi", "hash-a")])],
    });
    const result = await t.mutation(
      internal.contentSync.publicRoutes.internal.syncShards,
      { shards: [makeShard(5, [])] }
    );
    const shardStates = await t.query(
      internal.contentSync.publicRoutes.internal.listShardStates,
      { paginationOpts: { cursor: null, numItems: 10 } }
    );

    expect(result.deleted).toBe(1);
    expect(shardStates.page).toEqual([]);
  });
});

/** Builds one deterministic shard fixture. */
function makeShard(shard: number, routes: SyncRoute[]): SyncShard {
  return { hash: `shard-${shard}`, routes, shard };
}

/** Builds one minimal public route sync row. */
function makeRoute(publicPath: string, contentHash: string): SyncRoute {
  return {
    contentHash,
    kind: "subject-topic",
    locale: "id",
    publicPath,
    sitemap: true,
    title: publicPath,
  };
}
