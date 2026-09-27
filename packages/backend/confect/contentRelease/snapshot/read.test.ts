import { RegisteredConvexFunction } from "@confect/server";
import { assert, describe, expect, it } from "@effect/vitest";
import { canonicalizeContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot/data";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { convexModules } from "@repo/backend/confect/test.setup";
import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import {
  TEST_DIGEST,
  TEST_RELEASE_ID,
} from "@repo/backend/test/content/release";
import {
  makeProgramSnapshotData,
  stageProgramSnapshot,
} from "@repo/backend/test/program/snapshot";
import { makeQuranSearch } from "@repo/backend/test/quran/rows";
import {
  activateQuranSnapshot,
  makeQuranSnapshotRow,
} from "@repo/backend/test/quran/snapshot";
import {
  activateTryoutSnapshot,
  makeTryoutCatalogRow,
  makeTryoutPlacementRow,
} from "@repo/backend/test/tryout/snapshot";
import { convexTest } from "convex-test";
import { Effect, Struct } from "effect";

const readManifest = internal.contentRelease.snapshot.read.manifest;
const readRows = internal.contentRelease.snapshot.read.rows;
describe("contentRelease/snapshot/read", () => {
  it.live.each([
    {
      scenario: "empty",
      afterBatchIndex: -1,
    },
    {
      scenario: "missing-tail",
      afterBatchIndex: 0,
    },
    {
      scenario: "missing-cursor",
      afterBatchIndex: 0,
    },
    {
      scenario: "duplicate",
      afterBatchIndex: -1,
    },
    {
      scenario: "duplicate-cursor",
      afterBatchIndex: 0,
    },
    {
      scenario: "shifted",
      afterBatchIndex: 0,
    },
    {
      scenario: "oversized",
      afterBatchIndex: 0,
    },
    {
      scenario: "foreign-cursor",
      afterBatchIndex: 0,
    },
    {
      scenario: "unknown-cursor",
      afterBatchIndex: 99,
    },
    {
      scenario: "false-terminal",
      afterBatchIndex: 0,
    },
  ])(
    "rejects the $scenario snapshot ledger before returning a successful page",
    ({ scenario, afterBatchIndex }) =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const data = yield* makeProgramSnapshotData();
        yield* Effect.promise(async () => {
          const t = convexTest(schema, convexModules);
          await t.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              stageProgramSnapshot(data, 3).pipe(
                Effect.provide(
                  RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                )
              )
            )
          );
          await t.mutation(async (ctx) => {
            const rows = await ctx.db
              .query("snapshotBatches")
              .withIndex("by_releaseId_and_family_and_batchIndex", (q) =>
                q.eq("releaseId", TEST_RELEASE_ID).eq("family", "program")
              )
              .collect();
            const [first, second, last] = rows;
            assert(first && second && last);
            switch (scenario) {
              case "empty":
                for (const row of rows) {
                  await ctx.db.delete("snapshotBatches", row._id);
                }
                break;
              case "missing-tail":
                await ctx.db.delete("snapshotBatches", last._id);
                break;
              case "missing-cursor":
                await ctx.db.delete("snapshotBatches", first._id);
                break;
              case "duplicate":
              case "duplicate-cursor":
                await ctx.db.insert(
                  "snapshotBatches",
                  Struct.omit(first, ["_id", "_creationTime"])
                );
                break;
              case "shifted":
                await ctx.db.patch("snapshotBatches", second._id, {
                  firstIndex: 4,
                });
                break;
              case "oversized":
                await ctx.db.patch("snapshotBatches", second._id, {
                  rowCount: data.rowJson.length,
                });
                break;
              case "foreign-cursor":
                await ctx.db.patch("snapshotBatches", first._id, {
                  snapshotId: TEST_DIGEST,
                });
                break;
              case "false-terminal":
                await ctx.db.delete("snapshotBatches", second._id);
                await ctx.db.delete("snapshotBatches", last._id);
                break;
              default:
                break;
            }
          });
          await expect(
            t.query(readRows, {
              afterBatchIndex,
              family: "program",
              releaseId: TEST_RELEASE_ID,
            })
          ).rejects.toMatchObject({
            data: {
              code: "CONTENT_RELEASE_INTEGRITY",
            },
          });
        });
      })
  );
  it.live.each(["quran", "tryout"] as const)(
    "replays exact %s snapshot bytes and rejects lost rows or manifests",
    (family) =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const quran = makeQuranSearch("en", 1, "Technical search text");
        const catalog = makeTryoutCatalogRow();
        const placement = makeTryoutPlacementRow();
        const snapshotId = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            family === "quran"
              ? activateQuranSnapshot(ctx, [quran])
              : activateTryoutSnapshot(ctx, {
                  catalog: [catalog.record.row],
                  placements: [placement.record.row],
                })
          )
        );
        const rowJson =
          family === "quran"
            ? [
                canonicalizeContentSnapshotRow(
                  yield* makeQuranSnapshotRow(snapshotId, quran)
                ),
              ]
            : [catalog, placement].map(canonicalizeContentSnapshotRow);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            ctx.db.insert("snapshotBatches", {
              batchHash: TEST_DIGEST,
              batchIndex: 0,
              createdAt: 1,
              family,
              firstIndex: 0,
              releaseId: TEST_RELEASE_ID,
              rowCount: rowJson.length,
              sequence: 1,
              snapshotId,
            })
          )
        );
        const args = {
          family,
          releaseId: TEST_RELEASE_ID,
          afterBatchIndex: -1,
        };
        yield* Effect.promise(() =>
          expect(t.query(readRows, args)).resolves.toEqual({
            batchIndex: 0,
            done: true,
            firstIndex: 0,
            nextBatchIndex: 0,
            rowJson,
            snapshotId,
          })
        );
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const manifest = await ctx.db.query("contentSnapshots").unique();
            assert(manifest);
            await ctx.db.delete("contentSnapshots", manifest._id);
            if (family === "quran") {
              const row = await ctx.db.query("quranRows").first();
              assert(row);
              await ctx.db.delete("quranRows", row._id);
            } else {
              const row = await ctx.db.query("tryoutPlacements").first();
              assert(row);
              await ctx.db.delete("tryoutPlacements", row._id);
            }
          })
        );
        yield* Effect.promise(() =>
          expect(t.query(readRows, args)).rejects.toMatchObject({
            data: {
              code: "CONTENT_RELEASE_INTEGRITY",
            },
          })
        );
        yield* Effect.promise(() =>
          expect(
            t.query(readManifest, {
              family,
              releaseId: TEST_RELEASE_ID,
            })
          ).rejects.toMatchObject({
            data: {
              code: "CONTENT_RELEASE_MISSING",
            },
          })
        );
      })
  );
  it.live("replays one manifest and contiguous bounded row pages", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const data = yield* makeProgramSnapshotData();
      const t = convexTest(schema, convexModules);
      const batchSize = 3;
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            stageProgramSnapshot(data, batchSize).pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
              )
            )
          )
        )
      );
      yield* Effect.promise(() =>
        expect(
          t.query(readManifest, {
            family: "program",
            releaseId: TEST_RELEASE_ID,
          })
        ).resolves.toBe(data.manifestJson)
      );
      yield* Effect.promise(() =>
        expect(
          t.query(readRows, {
            afterBatchIndex: -1,
            family: "program",
            releaseId: TEST_RELEASE_ID,
          })
        ).resolves.toEqual({
          batchIndex: 0,
          done: false,
          firstIndex: 0,
          nextBatchIndex: 0,
          rowJson: data.rowJson.slice(0, batchSize),
          snapshotId: data.snapshotId,
        })
      );
      yield* Effect.promise(() =>
        expect(
          t.query(readRows, {
            afterBatchIndex: 0,
            family: "program",
            releaseId: TEST_RELEASE_ID,
          })
        ).resolves.toEqual({
          batchIndex: 1,
          done: false,
          firstIndex: batchSize,
          nextBatchIndex: 1,
          rowJson: data.rowJson.slice(batchSize, batchSize * 2),
          snapshotId: data.snapshotId,
        })
      );
      yield* Effect.promise(() =>
        expect(
          t.query(readRows, {
            afterBatchIndex: 1,
            family: "program",
            releaseId: TEST_RELEASE_ID,
          })
        ).resolves.toEqual({
          batchIndex: 2,
          done: true,
          firstIndex: batchSize * 2,
          nextBatchIndex: 2,
          rowJson: data.rowJson.slice(batchSize * 2),
          snapshotId: data.snapshotId,
        })
      );
      yield* Effect.promise(() =>
        expect(
          t.query(readRows, {
            afterBatchIndex: 2,
            family: "program",
            releaseId: TEST_RELEASE_ID,
          })
        ).resolves.toEqual({
          batchIndex: 2,
          done: true,
          firstIndex: data.rowJson.length,
          nextBatchIndex: 2,
          rowJson: [],
          snapshotId: data.snapshotId,
        })
      );
    })
  );
  it.live("rejects inherited-family reads and missing physical rows", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const data = yield* makeProgramSnapshotData();
      const inherited = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        inherited.mutation((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            stageProgramSnapshot(data).pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
              )
            )
          )
        )
      );
      yield* Effect.promise(() =>
        expect(
          inherited.query(readManifest, {
            family: "quran",
            releaseId: TEST_RELEASE_ID,
          })
        ).rejects.toMatchObject({
          data: {
            code: "CONTENT_RELEASE_STATE",
          },
        })
      );
      yield* Effect.promise(() =>
        expect(
          inherited.query(readRows, {
            family: "quran",
            releaseId: TEST_RELEASE_ID,
            afterBatchIndex: -1,
          })
        ).rejects.toMatchObject({
          data: {
            code: "CONTENT_RELEASE_STATE",
          },
        })
      );
      const missing = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        missing.mutation((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            stageProgramSnapshot(data).pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
              )
            )
          )
        )
      );
      yield* Effect.promise(() =>
        missing.mutation(async (ctx) => {
          const row = await ctx.db
            .query("curriculumRoutes")
            .withIndex("by_snapshotId_and_index", (query) =>
              query.eq("snapshotId", data.snapshotId).eq("index", 2)
            )
            .unique();
          assert(row, "Expected staged program row.");
          await ctx.db.delete("curriculumRoutes", row._id);
        })
      );
      yield* Effect.promise(() =>
        expect(
          missing.query(readRows, {
            afterBatchIndex: -1,
            family: "program",
            releaseId: TEST_RELEASE_ID,
          })
        ).rejects.toMatchObject({
          data: {
            code: "CONTENT_RELEASE_INTEGRITY",
          },
        })
      );
    })
  );
  it.live("rejects a non-contiguous immutable batch ledger", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const data = yield* makeProgramSnapshotData();
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            stageProgramSnapshot(data, 3).pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
              )
            )
          )
        )
      );
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const second = await ctx.db
            .query("snapshotBatches")
            .withIndex("by_releaseId_and_family_and_batchIndex", (query) =>
              query
                .eq("releaseId", TEST_RELEASE_ID)
                .eq("family", "program")
                .eq("batchIndex", 1)
            )
            .unique();
          assert(second, "Expected second snapshot batch.");
          await ctx.db.patch("snapshotBatches", second._id, {
            batchIndex: 2,
          });
        })
      );
      yield* Effect.promise(() =>
        expect(
          t.query(readRows, {
            afterBatchIndex: 0,
            family: "program",
            releaseId: TEST_RELEASE_ID,
          })
        ).rejects.toMatchObject({
          data: {
            code: "CONTENT_RELEASE_INTEGRITY",
          },
        })
      );
    })
  );
});
