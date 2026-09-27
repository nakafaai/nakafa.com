import { RegisteredConvexFunction } from "@confect/server";
import { assert, describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { compactRows } from "@repo/backend/confect/contentRelease/compact/rows";
import { convexModules } from "@repo/backend/confect/test.setup";
import schema from "@repo/backend/convex/schema";
import {
  compactionIdentity,
  insertCompletedRelease,
} from "@repo/backend/test/content/compact";
import { convexTest } from "convex-test";
import { Effect } from "effect";

describe("contentRelease/compact/rows", () => {
  it("retires predecessors below the prior floor while preserving current tombstones and recreated content", async () => {
    const t = convexTest(schema, convexModules);
    const hashes = ["obsolete-before-delete", "obsolete-before-update"];
    await t.mutation(async (ctx) => {
      for (const artifactHash of hashes) {
        await ctx.db.insert("contentArtifacts", {
          artifactHash,
          artifactJson: "{}",
          createdAt: 0,
          retainUntil: 0,
        });
      }
      for (const contentKey of ["deleted", "recreated"]) {
        for (const sequence of [1, 3, 4]) {
          const deleted =
            contentKey === "deleted" ? sequence !== 1 : sequence === 1;
          let artifactHash: string | undefined;
          if (!deleted && contentKey === "deleted") {
            artifactHash = hashes[0];
          }
          if (!deleted && contentKey === "recreated") {
            artifactHash = sequence === 3 ? hashes[1] : "current";
          }
          await ctx.db.insert("contentHeads", {
            ...(artifactHash === undefined
              ? {}
              : {
                  artifactHash,
                }),
            artifactLocale: "en",
            contentKey,
            family: "material",
            index: 0,
            operation: deleted ? "delete" : "upsert",
            releaseId: `release-${sequence}`,
            sequence,
          });
          await ctx.db.insert("contentBindings", {
            appLocale: "en",
            batchHash: "technical",
            batchIndex: 0,
            contentKey,
            index: 0,
            operation: deleted ? "delete" : "bind",
            publicPath: contentKey,
            releaseId: `release-${sequence}`,
            routeJson: "{}",
            sequence,
          });
        }
      }
    });
    const compact = (phase: "heads" | "bindings", cursor: string | null) =>
      t.mutation((ctx) =>
        Effect.runPromise(
          compactRows(phase, 3, 4, cursor, 0).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        )
      );
    const first = await compact("heads", null);
    expect(first).toMatchObject({
      deleted: 4,
      done: false,
    });
    assert.ok(first.cursor);
    const second = await compact("heads", first.cursor);
    expect(second).toMatchObject({
      deleted: 0,
      done: false,
    });
    assert.ok(second.cursor);
    expect(await compact("heads", second.cursor)).toEqual({
      cursor: null,
      deleted: 0,
      done: true,
    });
    expect(await compact("bindings", null)).toEqual({
      cursor: null,
      deleted: 4,
      done: true,
    });
    const remaining = await t.query(async (ctx) => ({
      heads: await ctx.db.query("contentHeads").collect(),
      bindings: await ctx.db.query("contentBindings").collect(),
      artifacts: await ctx.db.query("contentArtifacts").collect(),
    }));
    expect(remaining.heads).toMatchObject([
      {
        contentKey: "deleted",
        operation: "delete",
        sequence: 4,
      },
      {
        artifactHash: "current",
        contentKey: "recreated",
        operation: "upsert",
        sequence: 4,
      },
    ]);
    expect(remaining.bindings.map(({ sequence }) => sequence)).toEqual([4, 4]);
    expect(remaining.artifacts).toHaveLength(2);
    expect(
      remaining.artifacts.every(({ retainUntil }) => retainUntil > Date.now())
    ).toBe(true);
  });
  it("pages route anchors without dropping the last page", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      for (let index = 0; index < 33; index += 1) {
        await ctx.db.insert("contentBindings", {
          appLocale: "en",
          batchHash: "technical",
          batchIndex: 0,
          contentKey: `key-${index}`,
          index,
          operation: "bind",
          publicPath: `route-${index}`,
          releaseId: "floor",
          routeJson: "{}",
          sequence: 4,
        });
      }
    });
    const first = await t.mutation((ctx) =>
      Effect.runPromise(
        compactRows("bindings", 3, 4, null, 0).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    expect(first).toMatchObject({
      deleted: 0,
      done: false,
    });
    assert.ok(first.cursor);
    expect(
      await t.mutation((ctx) =>
        Effect.runPromise(
          compactRows("bindings", 3, 4, first.cursor, 0).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        )
      )
    ).toEqual({
      cursor: null,
      deleted: 0,
      done: true,
    });
    expect(
      await t.query((ctx) => ctx.db.query("contentBindings").collect())
    ).toHaveLength(33);
  });
  it("deletes obsolete tombstone items across bounded pages without touching the floor", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      for (let index = 0; index < 6; index += 1) {
        await ctx.db.insert("contentItems", {
          artifactLocale: "en",
          artifactReady: true,
          contentKey: `deleted-${index}`,
          index,
          itemBatchHash: "technical",
          itemBatchIndex: 0,
          itemJson: "{}",
          projectionReady: true,
          releaseId: index === 5 ? "floor" : "obsolete",
          rollbackJson: "{}",
          sequence: index === 5 ? 4 : 3,
          stagedAt: 0,
        });
      }
    });
    const first = await t.mutation((ctx) =>
      Effect.runPromise(
        compactRows("items", 3, 4, null, 0).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    expect(first).toMatchObject({
      deleted: 4,
      done: false,
    });
    assert.ok(first.cursor);
    expect(
      await t.mutation((ctx) =>
        Effect.runPromise(
          compactRows("items", 3, 4, first.cursor, 0).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        )
      )
    ).toEqual({
      cursor: null,
      deleted: 1,
      done: true,
    });
    expect(
      await t.query((ctx) => ctx.db.query("contentItems").collect())
    ).toMatchObject([
      {
        contentKey: "deleted-5",
        sequence: 4,
      },
    ]);
  });
  it.each(["batches", "releases"] as const)(
    "resumes obsolete %s through a full maintenance page",
    async (phase) => {
      const t = convexTest(schema, convexModules);
      await t.mutation(async (ctx) => {
        for (let sequence = 1; sequence <= 35; sequence += 1) {
          if (phase === "releases") {
            await insertCompletedRelease(ctx, compactionIdentity(sequence));
          } else {
            await ctx.db.insert("snapshotBatches", {
              batchHash: "technical",
              batchIndex: 0,
              createdAt: 0,
              family: "program",
              firstIndex: 0,
              releaseId: `release-${sequence}`,
              rowCount: 1,
              sequence,
              snapshotId: `snapshot-${sequence}`,
            });
          }
        }
      });
      const first = await t.mutation((ctx) =>
        Effect.runPromise(
          compactRows(phase, 1, 34, null, 0).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        )
      );
      expect(first).toMatchObject({
        deleted: 32,
        done: false,
      });
      assert.ok(first.cursor);
      expect(
        await t.mutation((ctx) =>
          Effect.runPromise(
            compactRows(phase, 1, 34, first.cursor, 0).pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
              )
            )
          )
        )
      ).toEqual({
        cursor: null,
        deleted: 1,
        done: true,
      });
      const remaining = await t.query(async (ctx) => {
        const rows =
          phase === "releases"
            ? await ctx.db.query("contentReleases").collect()
            : await ctx.db.query("snapshotBatches").collect();
        return rows.map(({ sequence }) => sequence);
      });
      expect(remaining).toEqual([34, 35]);
    }
  );
});
