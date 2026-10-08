import { RegisteredConvexFunction } from "@confect/server";
import { assert, describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { compactRows } from "@repo/backend/confect/contentRelease/compact/rows";
import { CONTENT_DOCUMENT_LIMIT } from "@repo/backend/confect/contentRelease/document";
import {
  COMPACTION_HEAD_COUNT,
  COMPACTION_ITEM_COUNT,
  COMPACTION_PAGE_BYTES,
  TRANSACTION_READ_HEADROOM,
  TRANSACTION_READ_LIMIT,
} from "@repo/backend/confect/contentRelease/spec";
import { convexModules } from "@repo/backend/confect/test.setup";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { insertTestArtifact } from "@repo/backend/test/content/artifact";
import {
  insertCeilingHead,
  insertCeilingItem,
  insertCeilingReferences,
  transactionBytes,
} from "@repo/backend/test/content/budget";
import {
  compactionIdentity,
  insertCompletedRelease,
} from "@repo/backend/test/content/compact";
import { testTextHash } from "@repo/backend/test/content/release";
import { convexTest } from "convex-test";
import { Array as Arr, Clock, Effect } from "effect";

/** Provides one persisted compaction page with a mutation transaction. */
function compactPage(
  ctx: MutationCtx,
  phase: Parameters<typeof compactRows>[0],
  from: number,
  floor: number,
  cursor: null | string = null
) {
  return compactRows(phase, from, floor, cursor, 0).pipe(
    Effect.provide(RegisteredConvexFunction.mutationLayer(confectSchema, ctx))
  );
}

describe("contentRelease/compact/rows", () => {
  it.live(
    "retires predecessors below the prior floor while preserving current tombstones and recreated content",
    () =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;
        const runtimeServices = yield* Effect.context<never>();
        yield* Effect.promise(async () => {
          const t = convexTest(schema, convexModules);
          const hashes = ["obsolete-before-delete", "obsolete-before-update"];
          await t.mutation(async (ctx) => {
            for (const artifactHash of hashes) {
              await insertTestArtifact(ctx, {
                artifactHash,
                artifactJson: "{}",
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
          const compact = (phase: "heads" | "bindings") =>
            t.mutation((ctx) =>
              Effect.runPromiseWith(runtimeServices)(
                compactPage(ctx, phase, 3, 4)
              )
            );
          expect(await compact("heads")).toEqual({
            cursor: null,
            deleted: 4,
            done: true,
          });
          expect(await compact("bindings")).toEqual({
            cursor: null,
            deleted: 4,
            done: true,
          });
          const remaining = await t.query(async (ctx) => ({
            heads: await ctx.db.query("contentHeads").collect(),
            bindings: await ctx.db.query("contentBindings").collect(),
            facts: await ctx.db.query("contentArtifactFacts").collect(),
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
          expect(
            Arr.map(remaining.bindings, ({ sequence }) => sequence)
          ).toEqual([4, 4]);
          expect(remaining.facts).toHaveLength(2);
          expect(
            Arr.every(remaining.facts, ({ retainUntil }) => retainUntil > now)
          ).toBe(true);
        });
      })
  );
  it("keeps a full heads page proving maximal references under the read budget", async () => {
    const t = convexTest(schema, convexModules);
    const keys = Array.from(
      { length: COMPACTION_HEAD_COUNT },
      (_, index) => `test:budget-${index}`
    );
    const artifact = (contentKey: string, sequence: number) =>
      testTextHash(`${contentKey}@${sequence}`);
    // Each paged version and its predecessor below the window release one
    // artifact that a maximal head, item, and placement still name.
    const released = Arr.flatMap(keys, (contentKey) => [
      artifact(contentKey, 1),
      artifact(contentKey, 2),
    ]);
    await t.mutation(async (ctx) => {
      for (const [index, contentKey] of keys.entries()) {
        for (const sequence of [1, 2, 3]) {
          await insertCeilingHead(ctx, {
            artifactHash: artifact(contentKey, sequence),
            contentKey,
            index,
            sequence,
          });
        }
      }
      await insertCeilingReferences(ctx, released, 4);
    });

    const { bytesRead, result } = await t.mutation(async (ctx) => ({
      result: await Effect.runPromise(compactPage(ctx, "heads", 2, 3)),
      bytesRead: await transactionBytes(ctx),
    }));

    expect(result.deleted).toBe(released.length);
    expect(bytesRead).toBeGreaterThan(released.length * CONTENT_DOCUMENT_LIMIT);
    expect(bytesRead).toBeLessThanOrEqual(
      TRANSACTION_READ_LIMIT - TRANSACTION_READ_HEADROOM
    );
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
      Effect.runPromise(compactPage(ctx, "bindings", 3, 4))
    );
    expect(first).toMatchObject({
      deleted: 0,
      done: false,
    });
    assert.ok(first.cursor);
    expect(
      await t.mutation((ctx) =>
        Effect.runPromise(compactPage(ctx, "bindings", 3, 4, first.cursor))
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
    const floorIndex = COMPACTION_ITEM_COUNT + 1;
    await t.mutation(async (ctx) => {
      for (let index = 0; index <= floorIndex; index += 1) {
        await ctx.db.insert("contentItems", {
          artifactLocale: "en",
          artifactReady: true,
          contentKey: `deleted-${index}`,
          index,
          itemBatchHash: "technical",
          itemBatchIndex: 0,
          itemJson: "{}",
          projectionReady: true,
          releaseId: index === floorIndex ? "floor" : "obsolete",
          rollbackJson: "{}",
          sequence: index === floorIndex ? 4 : 3,
          stagedAt: 0,
        });
      }
    });
    const first = await t.mutation((ctx) =>
      Effect.runPromise(compactPage(ctx, "items", 3, 4))
    );
    expect(first).toMatchObject({
      deleted: COMPACTION_ITEM_COUNT,
      done: false,
    });
    assert.ok(first.cursor);
    expect(
      await t.mutation((ctx) =>
        Effect.runPromise(compactPage(ctx, "items", 3, 4, first.cursor))
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
        contentKey: `deleted-${floorIndex}`,
        sequence: 4,
      },
    ]);
  });
  it("keeps a full items page proving maximal references under the read budget", async () => {
    const t = convexTest(schema, convexModules);
    const released = Array.from({ length: COMPACTION_ITEM_COUNT }, (_, index) =>
      testTextHash(`item-${index}`)
    );
    // Earlier items stay below the page byte bound together, so the last item
    // crosses it at the content document ceiling.
    const earlierLimit = Math.floor(
      COMPACTION_PAGE_BYTES / (COMPACTION_ITEM_COUNT - 1)
    );
    await t.mutation(async (ctx) => {
      for (const [index, artifactHash] of released.entries()) {
        await insertCeilingItem(
          ctx,
          {
            artifactHash,
            contentKey: `test:budget-${index}`,
            index,
            sequence: 2,
          },
          index < released.length - 1 ? earlierLimit : CONTENT_DOCUMENT_LIMIT
        );
      }
      await insertCeilingReferences(ctx, released, 3);
    });

    const { bytesRead, result } = await t.mutation(async (ctx) => ({
      result: await Effect.runPromise(compactPage(ctx, "items", 2, 3)),
      bytesRead: await transactionBytes(ctx),
    }));

    expect(result.deleted).toBe(COMPACTION_ITEM_COUNT);
    expect(bytesRead).toBeGreaterThan(
      2 * COMPACTION_PAGE_BYTES + released.length * CONTENT_DOCUMENT_LIMIT
    );
    expect(bytesRead).toBeLessThanOrEqual(
      TRANSACTION_READ_LIMIT - TRANSACTION_READ_HEADROOM
    );
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
        Effect.runPromise(compactPage(ctx, phase, 1, 34))
      );
      expect(first).toMatchObject({
        deleted: 32,
        done: false,
      });
      assert.ok(first.cursor);
      expect(
        await t.mutation((ctx) =>
          Effect.runPromise(compactPage(ctx, phase, 1, 34, first.cursor))
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
        return Arr.map(rows, ({ sequence }) => sequence);
      });
      expect(remaining).toEqual([34, 35]);
    }
  );
});
