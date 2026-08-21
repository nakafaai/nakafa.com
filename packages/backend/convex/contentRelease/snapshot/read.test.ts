import type { ContentSnapshotManifest } from "@nakafa/aksara-contracts/release/snapshot/data";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { TEST_RELEASE_ID } from "@repo/backend/test/content-release";
import {
  makeProgramSnapshotData,
  stageProgramSnapshot,
} from "@repo/backend/test/program-snapshot";
import { describe, expect, it } from "@repo/testing/effect";
import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { Effect } from "effect";

type SnapshotFamily = ContentSnapshotManifest["family"];

interface ManifestArgs extends Record<string, string> {
  readonly family: SnapshotFamily;
  readonly releaseId: string;
}

interface RowArgs extends Record<string, number | string> {
  readonly afterBatchIndex: number;
  readonly family: SnapshotFamily;
  readonly releaseId: string;
}

interface RowPage {
  readonly batchIndex: number;
  readonly done: boolean;
  readonly firstIndex: number;
  readonly nextBatchIndex: number;
  readonly rowJson: readonly string[];
  readonly snapshotId: string;
}

const readManifest = makeFunctionReference<"query", ManifestArgs, string>(
  "contentRelease/snapshot/read:manifest"
);
const readRows = makeFunctionReference<"query", RowArgs, RowPage>(
  "contentRelease/snapshot/read:rows"
);

describe("contentRelease/snapshot/read", () => {
  it.live("replays one manifest and contiguous bounded row pages", () =>
    Effect.gen(function* () {
      const data = yield* makeProgramSnapshotData();
      const t = convexTest(schema, convexModules);
      const batchSize = 3;
      yield* Effect.promise(() => stageProgramSnapshot(t, data, batchSize));

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
      const data = yield* makeProgramSnapshotData();
      const inherited = convexTest(schema, convexModules);
      yield* Effect.promise(() => stageProgramSnapshot(inherited, data));
      yield* Effect.promise(() =>
        expect(
          inherited.query(readManifest, {
            family: "quran",
            releaseId: TEST_RELEASE_ID,
          })
        ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } })
      );

      const missing = convexTest(schema, convexModules);
      yield* Effect.promise(() => stageProgramSnapshot(missing, data));
      yield* Effect.promise(() =>
        missing.mutation(async (ctx) => {
          const row = await ctx.db
            .query("curriculumRoutes")
            .withIndex("by_snapshotId_and_index", (query) =>
              query.eq("snapshotId", data.snapshotId).eq("index", 2)
            )
            .unique();
          if (!row) {
            throw new Error("Expected staged program row.");
          }
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
        ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } })
      );
    })
  );

  it.live("rejects a non-contiguous immutable batch ledger", () =>
    Effect.gen(function* () {
      const data = yield* makeProgramSnapshotData();
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() => stageProgramSnapshot(t, data, 3));
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
          if (!second) {
            throw new Error("Expected second snapshot batch.");
          }
          await ctx.db.patch("snapshotBatches", second._id, { batchIndex: 2 });
        })
      );

      yield* Effect.promise(() =>
        expect(
          t.query(readRows, {
            afterBatchIndex: 0,
            family: "program",
            releaseId: TEST_RELEASE_ID,
          })
        ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } })
      );
    })
  );
});
