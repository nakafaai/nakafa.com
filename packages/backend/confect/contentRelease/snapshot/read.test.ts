import { RegisteredConvexFunction } from "@confect/server";
import { assert, describe, expect, it } from "@effect/vitest";
import { canonicalizeContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot/data";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { MAX_RUN_BYTES } from "@repo/backend/confect/contentRelease/snapshot/read.spec";
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
  activateAssessmentTestSnapshot,
  makeAssessmentTestSnapshot,
} from "@repo/backend/test/snapshot/assessment";
import { convexTest } from "convex-test";
import { Array as Arr, Effect, Match, Struct } from "effect";

const readManifest = internal.contentRelease.snapshot.read.manifest;
const readRows = internal.contentRelease.snapshot.read.rows;
/** Caps that read exactly one batch per page, as the ledger checks expect. */
const ONE_BATCH = { maxBatches: 1, maxBytes: MAX_RUN_BYTES };
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
            await Match.value(scenario).pipe(
              Match.when("empty", async () => {
                for (const row of rows) {
                  await ctx.db.delete("snapshotBatches", row._id);
                }
              }),
              Match.when("missing-tail", () =>
                ctx.db.delete("snapshotBatches", last._id)
              ),
              Match.when("missing-cursor", () =>
                ctx.db.delete("snapshotBatches", first._id)
              ),
              Match.whenOr("duplicate", "duplicate-cursor", () =>
                ctx.db.insert(
                  "snapshotBatches",
                  Struct.omit(first, ["_id", "_creationTime"])
                )
              ),
              Match.when("shifted", () =>
                ctx.db.patch("snapshotBatches", second._id, {
                  firstIndex: 4,
                })
              ),
              Match.when("oversized", () =>
                ctx.db.patch("snapshotBatches", second._id, {
                  rowCount: data.rowJson.length,
                })
              ),
              Match.when("foreign-cursor", () =>
                ctx.db.patch("snapshotBatches", first._id, {
                  snapshotId: TEST_DIGEST,
                })
              ),
              Match.when("false-terminal", async () => {
                await ctx.db.delete("snapshotBatches", second._id);
                await ctx.db.delete("snapshotBatches", last._id);
              }),
              Match.orElse(() => undefined)
            );
          });
          await expect(
            t.query(readRows, {
              ...ONE_BATCH,
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
  it.live.each(["quran", "assessment"] as const)(
    "replays exact %s snapshot bytes and rejects lost rows or manifests",
    (family) =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const quran = makeQuranSearch("en", 1, "Technical search text");
        const snapshotId = yield* Effect.promise(() =>
          t.mutation(async (ctx) =>
            family === "quran"
              ? activateQuranSnapshot(ctx, [quran])
              : (await activateAssessmentTestSnapshot(ctx)).snapshotId
          )
        );
        // The fixture's rows are rebuilt here, outside Convex, so their JSON
        // keeps the key order the stored text was written with.
        const rowJson =
          family === "quran"
            ? [
                canonicalizeContentSnapshotRow(
                  yield* makeQuranSnapshotRow(snapshotId, quran)
                ),
              ]
            : Arr.map(
                (yield* makeAssessmentTestSnapshot()).rows,
                canonicalizeContentSnapshotRow
              );
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
          ...ONE_BATCH,
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
              const row = await ctx.db.query("assessmentRows").first();
              assert(row);
              await ctx.db.delete("assessmentRows", row._id);
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
  it.live("replays one manifest and row pages bounded by their caps", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const data = yield* makeProgramSnapshotData();
      const t = convexTest(schema, convexModules);
      // Three batches hold the fixture: two full ones and the rest.
      const size = Math.ceil(data.rowJson.length / 3);
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            stageProgramSnapshot(data, size).pipe(
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
      const all = data.rowJson.length;
      const wide = { maxBatches: 128, maxBytes: MAX_RUN_BYTES };
      // [after, caps, first batch, done, next, first row, end row]
      const pages = [
        [-1, ONE_BATCH, 0, false, 0, 0, size],
        [0, ONE_BATCH, 1, false, 1, size, size * 2],
        [1, ONE_BATCH, 2, true, 2, size * 2, all],
        [2, ONE_BATCH, 2, true, 2, all, all],
        [
          -1,
          { maxBatches: 2, maxBytes: MAX_RUN_BYTES },
          0,
          false,
          1,
          0,
          size * 2,
        ],
        [-1, { maxBatches: 128, maxBytes: 1 }, 0, false, 0, 0, size],
        [-1, wide, 0, true, 2, 0, all],
      ] as const;
      for (const [after, caps, batch, done, next, from, to] of pages) {
        yield* Effect.promise(() =>
          expect(
            t.query(readRows, {
              ...caps,
              afterBatchIndex: after,
              family: "program",
              releaseId: TEST_RELEASE_ID,
            })
          ).resolves.toEqual({
            batchIndex: batch,
            done,
            firstIndex: from,
            nextBatchIndex: next,
            rowJson: Arr.take(Arr.drop(data.rowJson, from), to - from),
            snapshotId: data.snapshotId,
          })
        );
      }
      // A later batch that breaks the ledger fails the whole run.
      yield* Effect.promise(async () => {
        await t.mutation(async (ctx) => {
          const last = await ctx.db
            .query("snapshotBatches")
            .withIndex("by_releaseId_and_family_and_batchIndex", (query) =>
              query
                .eq("releaseId", TEST_RELEASE_ID)
                .eq("family", "program")
                .eq("batchIndex", 2)
            )
            .unique();
          assert(last);
          await ctx.db.patch("snapshotBatches", last._id, {
            firstIndex: last.firstIndex + 1,
          });
        });
        await expect(
          t.query(readRows, {
            ...wide,
            afterBatchIndex: -1,
            family: "program",
            releaseId: TEST_RELEASE_ID,
          })
        ).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
        });
      });
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
            ...ONE_BATCH,
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
            ...ONE_BATCH,
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
            ...ONE_BATCH,
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
