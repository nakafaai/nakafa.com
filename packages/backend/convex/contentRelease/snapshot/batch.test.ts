import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { TEST_RELEASE_ID } from "@repo/backend/test/content-release";
import { insertTestRelease } from "@repo/backend/test/content-stage";
import {
  makeProgramSnapshotData,
  stageProgramSnapshot,
} from "@repo/backend/test/program-snapshot";
import {
  TEST_STAGE_SNAPSHOT,
  TEST_STAGE_SNAPSHOT_BATCH,
} from "@repo/backend/test/snapshot-routes";
import { describe, expect, it } from "@repo/testing/effect";
import { convexTest } from "convex-test";
import { Effect } from "effect";

describe("contentRelease/snapshot/batch", () => {
  it.live(
    "stores one complete batch and replays it without counter drift",
    () =>
      Effect.gen(function* () {
        const data = yield* makeProgramSnapshotData();
        const t = convexTest(schema, convexModules);
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
