import { assert, describe, expect, it } from "@effect/vitest";
import {
  canonicalizeContentSnapshotRow,
  contentSnapshotId,
} from "@nakafa/aksara-contracts/release/snapshot/data";
import {
  inheritContentSnapshots,
  replaceContentSnapshot,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import { stageProgramRow } from "@repo/backend/confect/contentRelease/snapshot/program";
import { encodeSnapshotJson } from "@repo/backend/confect/contentRelease/wire";
import { runConvexProgram } from "@repo/backend/confect/runtime";
import { convexModules } from "@repo/backend/confect/test.setup";
import schema from "@repo/backend/convex/schema";
import {
  TEST_DIGEST,
  TEST_RELEASE_ID,
} from "@repo/backend/test/content/release";
import { insertTestRelease } from "@repo/backend/test/content/stage";
import {
  makeProgramSnapshotData,
  makeTechnicalProgram,
  stageProgramSnapshot,
} from "@repo/backend/test/program/snapshot";
import {
  makeQuranSnapshot,
  makeQuranSnapshotRow,
} from "@repo/backend/test/quran/snapshot";
import {
  TEST_STAGE_SNAPSHOT,
  TEST_STAGE_SNAPSHOT_BATCH,
} from "@repo/backend/test/snapshot/routes";
import {
  makeTryoutCatalogRow,
  makeTryoutPlacementRow,
  makeTryoutSnapshotManifest,
} from "@repo/backend/test/tryout/snapshot";
import { convexTest } from "convex-test";
import { Effect, Struct } from "effect";

describe("contentRelease/snapshot/batch", () => {
  it.live.each(["manifest", "ledger"] as const)(
    "rejects corrupted %s identity without changing staged rows or counters",
    (corruption) =>
      Effect.gen(function* () {
        const data = yield* makeProgramSnapshotData();
        const changed = yield* makeProgramSnapshotData([
          makeTechnicalProgram(3),
        ]);
        yield* Effect.promise(async () => {
          const t = convexTest(schema, convexModules);
          await stageProgramSnapshot(t, data);
          await t.mutation(async (ctx) => {
            if (corruption === "manifest") {
              const snapshot = await ctx.db.query("contentSnapshots").unique();
              assert(snapshot);
              await ctx.db.patch(snapshot._id, {
                snapshotJson: changed.manifestJson,
              });
            } else {
              const batch = await ctx.db.query("snapshotBatches").unique();
              assert(batch);
              await ctx.db.patch(batch._id, { snapshotId: changed.snapshotId });
            }
          });
          const read = () =>
            t.query(async (ctx) => ({
              release: await ctx.db.query("contentReleases").unique(),
              batches: await ctx.db.query("snapshotBatches").collect(),
              programs: await ctx.db.query("programCatalog").collect(),
              routes: await ctx.db.query("curriculumRoutes").collect(),
            }));
          const before = await read();
          await expect(
            t.mutation(TEST_STAGE_SNAPSHOT_BATCH, {
              batchIndex: 0,
              family: "program",
              releaseId: TEST_RELEASE_ID,
              rowJson: data.rowJson,
              snapshotId: data.snapshotId,
            })
          ).rejects.toMatchObject({
            data: {
              code:
                corruption === "manifest"
                  ? "CONTENT_RELEASE_INTEGRITY"
                  : "CONTENT_RELEASE_CONFLICT",
            },
          });
          expect(await read()).toEqual(before);
        });
      })
  );
  it.live.each(["quran", "tryout"] as const)(
    "stages and replays %s rows through the registered mutation without counter drift",
    (family) =>
      Effect.gen(function* () {
        const manifest = yield* family === "quran"
          ? makeQuranSnapshot()
          : makeTryoutSnapshotManifest();
        const snapshotId = contentSnapshotId(manifest);
        const rows =
          family === "quran"
            ? [yield* makeQuranSnapshotRow(snapshotId)]
            : [makeTryoutCatalogRow("en"), makeTryoutPlacementRow("en")];
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            insertTestRelease(ctx, {
              itemCount: 0,
              upsertCount: 0,
              projectionCount: 0,
              routeCount: 0,
              snapshots: {
                ...inheritContentSnapshots(null),
                [family]: replaceContentSnapshot({
                  baseSnapshotId: null,
                  resultSnapshotId: snapshotId,
                  rowCount: rows.length,
                  rowDigest: TEST_DIGEST,
                }),
              },
            })
          )
        );
        yield* Effect.promise(() =>
          t.mutation(TEST_STAGE_SNAPSHOT, {
            releaseId: TEST_RELEASE_ID,
            snapshotJson: encodeSnapshotJson(manifest),
          })
        );
        const args = {
          batchIndex: 0,
          family,
          releaseId: TEST_RELEASE_ID,
          rowJson: rows.map(canonicalizeContentSnapshotRow),
          snapshotId,
        };
        expect(
          yield* Effect.promise(() =>
            t.mutation(TEST_STAGE_SNAPSHOT_BATCH, args)
          )
        ).toMatchObject({ created: rows.length, unchanged: 0 });
        expect(
          yield* Effect.promise(() =>
            t.mutation(TEST_STAGE_SNAPSHOT_BATCH, args)
          )
        ).toMatchObject({ created: 0, unchanged: rows.length });
        const state = yield* Effect.promise(() =>
          t.query(async (ctx) => ({
            batches: await ctx.db.query("snapshotBatches").collect(),
            quranRows: await ctx.db.query("quranRows").collect(),
            quranSearch: await ctx.db.query("quranSearch").collect(),
            catalog: await ctx.db.query("tryoutCatalog").collect(),
            placements: await ctx.db.query("tryoutPlacements").collect(),
            release: await ctx.db.query("contentReleases").unique(),
          }))
        );
        expect(state.batches).toHaveLength(1);
        expect(state.release).toMatchObject({
          stagedSnapshotBatches: 1,
          stagedSnapshotRows: rows.length,
        });
        expect(state.quranRows).toHaveLength(family === "quran" ? 1 : 0);
        expect(state.quranSearch).toHaveLength(family === "quran" ? 1 : 0);
        expect(state.catalog).toHaveLength(family === "tryout" ? 1 : 0);
        expect(state.placements).toHaveLength(family === "tryout" ? 1 : 0);
      })
  );

  it.live.each([0, 1])(
    "rejects duplicate ledger identity before batch %s can retry or continue",
    (batchIndex) =>
      Effect.gen(function* () {
        const data = yield* makeProgramSnapshotData();
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            insertTestRelease(ctx, { snapshots: data.snapshots })
          )
        );
        yield* Effect.promise(() =>
          t.mutation(TEST_STAGE_SNAPSHOT, {
            releaseId: TEST_RELEASE_ID,
            snapshotJson: data.manifestJson,
          })
        );
        const args = {
          batchIndex: 0,
          family: "program" as const,
          releaseId: TEST_RELEASE_ID,
          rowJson: data.rowJson.slice(0, 1),
          snapshotId: data.snapshotId,
        };
        yield* Effect.promise(() =>
          t.mutation(TEST_STAGE_SNAPSHOT_BATCH, args)
        );
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const batch = await ctx.db.query("snapshotBatches").unique();
            assert(batch);
            await ctx.db.insert(
              "snapshotBatches",
              Struct.omit(batch, ["_id", "_creationTime"])
            );
          })
        );
        yield* Effect.promise(() =>
          expect(
            t.mutation(TEST_STAGE_SNAPSHOT_BATCH, { ...args, batchIndex })
          ).rejects.toMatchObject({
            data: { code: "CONTENT_RELEASE_INTEGRITY" },
          })
        );
        const state = yield* Effect.promise(() =>
          t.query(async (ctx) => ({
            batches: await ctx.db.query("snapshotBatches").collect(),
            release: await ctx.db.query("contentReleases").unique(),
          }))
        );
        expect(state.batches).toHaveLength(2);
        expect(state.release).toMatchObject({
          stagedSnapshotBatches: 1,
          stagedSnapshotRows: 1,
        });
      })
  );

  it.live(
    "reuses immutable physical rows and replays the complete batch without counter drift",
    () =>
      Effect.gen(function* () {
        const data = yield* makeProgramSnapshotData();
        const t = convexTest(schema, convexModules);
        const first = data.rows[0];
        assert(first && first.family === "program");
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(
              stageProgramRow(
                ctx,
                data.snapshotId,
                0,
                first,
                canonicalizeContentSnapshotRow(first)
              )
            )
          )
        );
        yield* Effect.promise(() => stageProgramSnapshot(t, data));

        yield* Effect.promise(() =>
          expect(
            t.mutation(TEST_STAGE_SNAPSHOT_BATCH, {
              batchIndex: 0,
              family: "program",
              releaseId: TEST_RELEASE_ID,
              rowJson: data.rowJson,
              snapshotId: data.snapshotId,
            })
          ).resolves.toEqual({
            batchIndex: 0,
            created: 0,
            family: "program",
            releaseId: TEST_RELEASE_ID,
            snapshotId: data.snapshotId,
            unchanged: data.rowJson.length,
          })
        );
        const stored = yield* Effect.promise(() =>
          t.run(async (ctx) => ({
            batches: await ctx.db.query("snapshotBatches").collect(),
            curriculum: await ctx.db.query("curriculumRoutes").collect(),
            programs: await ctx.db.query("programCatalog").collect(),
            release: await ctx.db.query("contentReleases").unique(),
          }))
        );
        const programCount = data.rows.filter(
          ({ record }) => record.kind === "program"
        ).length;
        const curriculumCount = data.rows.filter(
          ({ record }) => record.kind === "curriculum"
        ).length;
        expect(stored.batches).toHaveLength(1);
        expect(stored.programs).toHaveLength(programCount);
        expect(stored.curriculum).toHaveLength(curriculumCount);
        expect(stored.release).toMatchObject({
          stagedSnapshotBatches: 1,
          stagedSnapshotRows: data.rowJson.length,
        });
      })
  );

  it.live("requires the signed manifest and contiguous family batches", () =>
    Effect.gen(function* () {
      const data = yield* makeProgramSnapshotData();
      const missing = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        missing.mutation((ctx) =>
          insertTestRelease(ctx, { snapshots: data.snapshots })
        )
      );
      yield* Effect.promise(() =>
        expect(
          missing.mutation(TEST_STAGE_SNAPSHOT_BATCH, {
            batchIndex: 0,
            family: "program",
            releaseId: TEST_RELEASE_ID,
            rowJson: data.rowJson,
            snapshotId: data.snapshotId,
          })
        ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_MISSING" } })
      );

      const gap = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        gap.mutation((ctx) =>
          insertTestRelease(ctx, { snapshots: data.snapshots })
        )
      );
      yield* Effect.promise(() =>
        gap.mutation(TEST_STAGE_SNAPSHOT, {
          releaseId: TEST_RELEASE_ID,
          snapshotJson: data.manifestJson,
        })
      );
      yield* Effect.promise(() =>
        expect(
          gap.mutation(TEST_STAGE_SNAPSHOT_BATCH, {
            batchIndex: 1,
            family: "program",
            releaseId: TEST_RELEASE_ID,
            rowJson: data.rowJson,
            snapshotId: data.snapshotId,
          })
        ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } })
      );
    })
  );

  it.live(
    "rejects changed retries, count overflow, and cross-family rows",
    () =>
      Effect.gen(function* () {
        const data = yield* makeProgramSnapshotData();
        const [firstRow] = data.rowJson;
        if (!firstRow) {
          throw new Error("Expected one program snapshot row.");
        }
        const changed = convexTest(schema, convexModules);
        yield* Effect.promise(() => stageProgramSnapshot(changed, data));
        yield* Effect.promise(() =>
          expect(
            changed.mutation(TEST_STAGE_SNAPSHOT_BATCH, {
              batchIndex: 0,
              family: "program",
              releaseId: TEST_RELEASE_ID,
              rowJson: [...data.rowJson].reverse(),
              snapshotId: data.snapshotId,
            })
          ).rejects.toMatchObject({
            data: { code: "CONTENT_RELEASE_CONFLICT" },
          })
        );
        yield* Effect.promise(() =>
          expect(
            changed.mutation(TEST_STAGE_SNAPSHOT_BATCH, {
              batchIndex: 1,
              family: "program",
              releaseId: TEST_RELEASE_ID,
              rowJson: [firstRow],
              snapshotId: data.snapshotId,
            })
          ).rejects.toMatchObject({
            data: { code: "CONTENT_RELEASE_INTEGRITY" },
          })
        );

        const wrongFamily = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          wrongFamily.mutation((ctx) =>
            insertTestRelease(ctx, { snapshots: data.snapshots })
          )
        );
        yield* Effect.promise(() =>
          expect(
            wrongFamily.mutation(TEST_STAGE_SNAPSHOT_BATCH, {
              batchIndex: 0,
              family: "quran",
              releaseId: TEST_RELEASE_ID,
              rowJson: data.rowJson,
              snapshotId: data.snapshotId,
            })
          ).rejects.toMatchObject({
            data: { code: "CONTENT_RELEASE_INTEGRITY" },
          })
        );
      })
  );

  it.live("rejects empty batches and releases that stopped staging", () =>
    Effect.gen(function* () {
      const data = yield* makeProgramSnapshotData();
      const empty = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        empty.mutation((ctx) =>
          insertTestRelease(ctx, { snapshots: data.snapshots })
        )
      );
      yield* Effect.promise(() =>
        expect(
          empty.mutation(TEST_STAGE_SNAPSHOT_BATCH, {
            batchIndex: 0,
            family: "program",
            releaseId: TEST_RELEASE_ID,
            rowJson: [],
            snapshotId: data.snapshotId,
          })
        ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_LIMIT" } })
      );

      const closed = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        closed.mutation((ctx) =>
          insertTestRelease(ctx, {
            snapshots: data.snapshots,
            status: "verifying",
          })
        )
      );
      yield* Effect.promise(() =>
        expect(
          closed.mutation(TEST_STAGE_SNAPSHOT_BATCH, {
            batchIndex: 0,
            family: "program",
            releaseId: TEST_RELEASE_ID,
            rowJson: data.rowJson,
            snapshotId: data.snapshotId,
          })
        ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } })
      );
    })
  );
});
