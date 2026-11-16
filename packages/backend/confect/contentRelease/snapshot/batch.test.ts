import { mutationLayer } from "@confect/server/RegisteredConvexFunction";
import { assert, describe, expect, it } from "@effect/vitest";
import {
  type ContentSnapshotRow,
  canonicalizeContentSnapshotRow,
} from "@nakafa/aksara-contracts/release/snapshot/data";
import {
  inheritContentSnapshots,
  replaceContentSnapshot,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import { MAX_SNAPSHOT_BATCH_COUNT } from "@nakafa/aksara-contracts/transport/limits";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { encodeSnapshotJson } from "@repo/backend/confect/contentRelease/wire";
import { convexModules } from "@repo/backend/confect/test.setup";
import schema from "@repo/backend/convex/schema";
import {
  TEST_DIGEST,
  TEST_RELEASE_ID,
} from "@repo/backend/test/content/release";
import { insertTestRelease } from "@repo/backend/test/content/stage";
import {
  makeProgramSnapshotData,
  type ProgramSnapshotData,
  readProgramStage,
  stageProgramSnapshot,
} from "@repo/backend/test/program/snapshot";
import {
  makeQuranSnapshot,
  makeQuranSnapshotRow,
} from "@repo/backend/test/quran/snapshot";
import { makeAssessmentTestSnapshot } from "@repo/backend/test/snapshot/assessment";
import {
  TEST_STAGE_SNAPSHOT,
  TEST_STAGE_SNAPSHOT_BATCH,
} from "@repo/backend/test/snapshot/routes";
import {
  stageTestRow,
  testSnapshotBatchArgs,
} from "@repo/backend/test/snapshot/stage";
import { convexTest } from "convex-test";
import { Array as Arr, Effect, Result, Struct } from "effect";

/** Stores the technical program release and its manifest, without rows. */
const stageProgramManifest = Effect.fn("test.snapshotBatch.programManifest")(
  function* (
    data: ProgramSnapshotData,
    options: Parameters<typeof insertTestRelease>[1] = {}
  ) {
    const t = convexTest(schema, convexModules);
    yield* Effect.promise(() =>
      t.mutation((ctx) =>
        insertTestRelease(ctx, { ...options, snapshots: data.snapshots })
      )
    );
    yield* Effect.promise(() =>
      t.mutation(TEST_STAGE_SNAPSHOT, {
        releaseId: TEST_RELEASE_ID,
        snapshotJson: data.manifestJson,
      })
    );
    return t;
  }
);

/** Prepares one program batch against the manifests the deployment stores. */
const programArgs = Effect.fn("test.snapshotBatch.programArgs")(function* (
  t: Effect.Success<ReturnType<typeof stageProgramManifest>>,
  data: ProgramSnapshotData,
  batchIndex = 0,
  rows: readonly ContentSnapshotRow[] = data.rows
) {
  if (!Arr.isReadonlyArrayNonEmpty(rows)) {
    return yield* Effect.die(new Error("Expected program rows."));
  }
  return yield* testSnapshotBatchArgs(t, {
    batchIndex,
    family: "program",
    releaseId: TEST_RELEASE_ID,
    rows,
    snapshotId: data.snapshotId,
  });
});

describe("contentRelease/snapshot/batch", () => {
  it.live(
    "rejects a ledger row of another snapshot without changing staged rows or counters",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const data = yield* makeProgramSnapshotData();
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              stageProgramSnapshot(data).pipe(
                Effect.provide(mutationLayer(confectSchema, ctx))
              )
            )
          )
        );
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const batch = await ctx.db.query("snapshotBatches").unique();
            assert(batch);
            await ctx.db.patch(batch._id, { snapshotId: TEST_DIGEST });
          })
        );
        const args = yield* programArgs(t, data);
        const before = yield* Effect.promise(() => t.query(readProgramStage));
        yield* Effect.promise(() =>
          expect(
            t.mutation(TEST_STAGE_SNAPSHOT_BATCH, args)
          ).rejects.toMatchObject({
            data: { code: "CONTENT_RELEASE_CONFLICT" },
          })
        );
        expect(yield* Effect.promise(() => t.query(readProgramStage))).toEqual(
          before
        );
      })
  );
  it.live.each(["quran", "assessment"] as const)(
    "stages and replays %s rows through the registered mutation without counter drift",
    (family) =>
      Effect.gen(function* () {
        const assessment = yield* makeAssessmentTestSnapshot();
        const manifest =
          family === "quran" ? yield* makeQuranSnapshot() : assessment.manifest;
        const snapshotId = manifest.manifest.snapshotId;
        const rows: readonly ContentSnapshotRow[] =
          family === "quran"
            ? [yield* makeQuranSnapshotRow(snapshotId)]
            : Arr.take(assessment.rows, MAX_SNAPSHOT_BATCH_COUNT);
        if (!Arr.isReadonlyArrayNonEmpty(rows)) {
          return yield* Effect.die(new Error("Expected snapshot rows."));
        }
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            insertTestRelease(ctx, {
              itemCount: 0,
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
              upsertCount: 0,
            })
          )
        );
        yield* Effect.promise(() =>
          t.mutation(TEST_STAGE_SNAPSHOT, {
            releaseId: TEST_RELEASE_ID,
            snapshotJson: encodeSnapshotJson(manifest),
          })
        );
        const args = yield* testSnapshotBatchArgs(t, {
          batchIndex: 0,
          family,
          releaseId: TEST_RELEASE_ID,
          rows,
          snapshotId,
        });
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
            assessmentRows: await ctx.db.query("assessmentRows").collect(),
            batches: await ctx.db.query("snapshotBatches").collect(),
            quranRows: await ctx.db.query("quranRows").collect(),
            quranSearch: await ctx.db.query("quranSearch").collect(),
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
        expect(state.assessmentRows).toHaveLength(
          family === "assessment" ? rows.length : 0
        );
      })
  );
  it.live.each([0, 1])(
    "rejects duplicate ledger identity before batch %s can retry or continue",
    (batchIndex) =>
      Effect.gen(function* () {
        const data = yield* makeProgramSnapshotData();
        const t = yield* stageProgramManifest(data);
        const first = yield* programArgs(t, data, 0, Arr.take(data.rows, 1));
        yield* Effect.promise(() =>
          t.mutation(TEST_STAGE_SNAPSHOT_BATCH, first)
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
        const args = yield* programArgs(
          t,
          data,
          batchIndex,
          Arr.take(data.rows, 1)
        );
        yield* Effect.promise(() =>
          expect(
            t.mutation(TEST_STAGE_SNAPSHOT_BATCH, args)
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
        const runtimeServices = yield* Effect.context<never>();
        const data = yield* makeProgramSnapshotData();
        const t = convexTest(schema, convexModules);
        const first = data.rows[0];
        assert(first);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              stageTestRow(
                data.snapshotId,
                0,
                first,
                canonicalizeContentSnapshotRow(first)
              ).pipe(Effect.provide(mutationLayer(confectSchema, ctx)))
            )
          )
        );
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              stageProgramSnapshot(data).pipe(
                Effect.provide(mutationLayer(confectSchema, ctx))
              )
            )
          )
        );
        const args = yield* programArgs(t, data);
        yield* Effect.promise(() =>
          expect(t.mutation(TEST_STAGE_SNAPSHOT_BATCH, args)).resolves.toEqual({
            batchIndex: 0,
            created: 0,
            family: "program",
            releaseId: TEST_RELEASE_ID,
            snapshotId: data.snapshotId,
            unchanged: data.rows.length,
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
        const programCount = Arr.filter(
          data.rows,
          ({ record }) => record.kind === "program"
        ).length;
        expect(stored.batches).toHaveLength(1);
        expect(stored.programs).toHaveLength(programCount);
        expect(stored.curriculum).toHaveLength(data.rows.length - programCount);
        expect(stored.release).toMatchObject({
          stagedSnapshotBatches: 1,
          stagedSnapshotRows: data.rows.length,
        });
      })
  );
  it.live("requires the stored manifest and contiguous family batches", () =>
    Effect.gen(function* () {
      const data = yield* makeProgramSnapshotData();
      const missing = yield* stageProgramManifest(data);
      const args = yield* programArgs(missing, data);
      yield* Effect.promise(() =>
        missing.mutation(async (ctx) => {
          const snapshot = await ctx.db.query("contentSnapshots").unique();
          assert(snapshot);
          await ctx.db.delete(snapshot._id);
        })
      );
      yield* Effect.promise(() =>
        expect(
          missing.mutation(TEST_STAGE_SNAPSHOT_BATCH, args)
        ).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_MISSING" },
        })
      );
      const gap = yield* stageProgramManifest(data);
      const later = yield* programArgs(gap, data, 1);
      yield* Effect.promise(() =>
        expect(
          gap.mutation(TEST_STAGE_SNAPSHOT_BATCH, later)
        ).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_CONFLICT" },
        })
      );
    })
  );
  it.live("rejects changed retries and batches beyond the signed counts", () =>
    Effect.gen(function* () {
      const data = yield* makeProgramSnapshotData();
      const t = yield* stageProgramManifest(data);
      const args = yield* programArgs(t, data);
      yield* Effect.promise(() => t.mutation(TEST_STAGE_SNAPSHOT_BATCH, args));
      const changed = yield* programArgs(t, data, 0, Arr.reverse(data.rows));
      const overflow = yield* programArgs(t, data, 1, Arr.take(data.rows, 1));
      yield* Effect.promise(() =>
        expect(
          t.mutation(TEST_STAGE_SNAPSHOT_BATCH, changed)
        ).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_CONFLICT" },
        })
      );
      yield* Effect.promise(() =>
        expect(
          t.mutation(TEST_STAGE_SNAPSHOT_BATCH, overflow)
        ).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
        })
      );
      const fresh = yield* stageProgramManifest(data);
      const total = yield* programArgs(fresh, data);
      yield* Effect.promise(() =>
        expect(
          fresh.mutation(TEST_STAGE_SNAPSHOT_BATCH, {
            ...total,
            totalRows: total.rows.length - 1,
          })
        ).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
        })
      );
    })
  );
  it.live.each([{ status: "verifying" }, { abortingAt: 1 }] as const)(
    "rejects rows once the release stops staging (%o)",
    (options) =>
      Effect.gen(function* () {
        const data = yield* makeProgramSnapshotData();
        const t = yield* stageProgramManifest(data);
        const args = yield* programArgs(t, data);
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const release = await ctx.db.query("contentReleases").unique();
            assert(release);
            await ctx.db.patch(release._id, options);
          })
        );
        yield* Effect.promise(() =>
          expect(
            t.mutation(TEST_STAGE_SNAPSHOT_BATCH, args)
          ).rejects.toMatchObject({
            data: { code: "CONTENT_RELEASE_STATE" },
          })
        );
      })
  );
  it.live("rejects rows prepared against another signed manifest", () =>
    Effect.gen(function* () {
      const data = yield* makeProgramSnapshotData();
      const t = yield* stageProgramManifest(data);
      const args = yield* programArgs(t, data);
      yield* Effect.promise(() =>
        expect(
          t.mutation(TEST_STAGE_SNAPSHOT_BATCH, {
            ...args,
            manifestHash: TEST_DIGEST,
          })
        ).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_STATE" },
        })
      );
      expect(
        yield* Effect.promise(() =>
          t.run((ctx) => ctx.db.query("snapshotBatches").collect())
        )
      ).toEqual([]);
    })
  );
  it.live(
    "stores prepared rows without decoding them, so a row slow to decode costs the mutation nothing",
    () =>
      Effect.gen(function* () {
        const data = yield* makeProgramSnapshotData();
        const t = yield* stageProgramManifest(data);
        const args = yield* programArgs(t, data);
        const rows = Arr.filterMap(args.rows, (row) =>
          row.kind === "program"
            ? Result.succeed({
                document: { ...row.document, rowJson: "not a signed row" },
                kind: row.kind,
              })
            : Result.failVoid
        );
        expect(
          yield* Effect.promise(() =>
            t.mutation(TEST_STAGE_SNAPSHOT_BATCH, { ...args, rows })
          )
        ).toMatchObject({ created: rows.length, unchanged: 0 });
        const stored = yield* Effect.promise(() =>
          t.run((ctx) => ctx.db.query("programCatalog").collect())
        );
        expect(Arr.map(stored, ({ rowJson }) => rowJson)).toEqual(
          Arr.map(rows, () => "not a signed row")
        );
      })
  );
});
