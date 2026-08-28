import { describe, expect, it } from "@effect/vitest";
import {
  inheritContentSnapshots,
  replaceContentSnapshot,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import { encodeSnapshotJson } from "@repo/backend/convex/contentRelease/wire";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { TEST_RELEASE_ID } from "@repo/backend/test/content/release";
import { insertTestRelease } from "@repo/backend/test/content/stage";
import { makeProgramSnapshotData } from "@repo/backend/test/program/snapshot";
import {
  makeBlockedQuranSnapshot,
  makeStoredQuranSnapshot,
} from "@repo/backend/test/quran/snapshot";
import { TEST_STAGE_SNAPSHOT } from "@repo/backend/test/snapshot/routes";
import { convexTest } from "convex-test";
import { Effect } from "effect";

describe("contentRelease/snapshot/manifest", () => {
  it.live(
    "stores one signed manifest with byte-identical retry semantics",
    () =>
      Effect.gen(function* () {
        const data = yield* makeProgramSnapshotData();
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            insertTestRelease(ctx, { snapshots: data.snapshots })
          )
        );

        yield* Effect.promise(() =>
          expect(
            t.mutation(TEST_STAGE_SNAPSHOT, {
              releaseId: TEST_RELEASE_ID,
              snapshotJson: data.manifestJson,
            })
          ).resolves.toEqual({
            created: 1,
            family: "program",
            releaseId: TEST_RELEASE_ID,
            snapshotId: data.snapshotId,
            unchanged: 0,
          })
        );
        yield* Effect.promise(() =>
          expect(
            t.mutation(TEST_STAGE_SNAPSHOT, {
              releaseId: TEST_RELEASE_ID,
              snapshotJson: data.manifestJson,
            })
          ).resolves.toMatchObject({ created: 0, unchanged: 1 })
        );
      })
  );

  it.live("rejects unsigned replacement state and changed stored bytes", () =>
    Effect.gen(function* () {
      const data = yield* makeProgramSnapshotData();
      const unsigned = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        unsigned.mutation((ctx) => insertTestRelease(ctx))
      );
      yield* Effect.promise(() =>
        expect(
          unsigned.mutation(TEST_STAGE_SNAPSHOT, {
            releaseId: TEST_RELEASE_ID,
            snapshotJson: data.manifestJson,
          })
        ).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
        })
      );

      const changed = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        changed.mutation((ctx) =>
          insertTestRelease(ctx, { snapshots: data.snapshots })
        )
      );
      yield* Effect.promise(() =>
        changed.mutation(TEST_STAGE_SNAPSHOT, {
          releaseId: TEST_RELEASE_ID,
          snapshotJson: data.manifestJson,
        })
      );
      yield* Effect.promise(() =>
        changed.mutation(async (ctx) => {
          const stored = await ctx.db.query("contentSnapshots").unique();
          if (!stored) {
            throw new Error("Expected staged program snapshot.");
          }
          await ctx.db.patch("contentSnapshots", stored._id, {
            snapshotJson: `${stored.snapshotJson} `,
          });
        })
      );
      yield* Effect.promise(() =>
        expect(
          changed.mutation(TEST_STAGE_SNAPSHOT, {
            releaseId: TEST_RELEASE_ID,
            snapshotJson: data.manifestJson,
          })
        ).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_CONFLICT" },
        })
      );
    })
  );

  it("rejects blocked Quran provenance before storing its manifest", async () => {
    const snapshot = makeBlockedQuranSnapshot();
    const snapshots = {
      ...inheritContentSnapshots(null),
      quran: replaceContentSnapshot({
        baseSnapshotId: null,
        resultSnapshotId: snapshot.manifest.snapshotId,
        rowCount: snapshot.manifest.projectionCount,
        rowDigest: snapshot.manifest.projectionDigest,
      }),
    };
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => insertTestRelease(ctx, { snapshots }));

    await expect(
      t.mutation(TEST_STAGE_SNAPSHOT, {
        releaseId: TEST_RELEASE_ID,
        snapshotJson: encodeSnapshotJson(snapshot),
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_UNSUPPORTED" },
    });
    await expect(
      t.run((ctx) => ctx.db.query("contentSnapshots").unique())
    ).resolves.toBeNull();
  });

  it.live("rejects a predecessor Quran manifest before storing it", () =>
    Effect.gen(function* () {
      const snapshot = yield* makeStoredQuranSnapshot();
      const snapshots = {
        ...inheritContentSnapshots(null),
        quran: replaceContentSnapshot({
          baseSnapshotId: null,
          resultSnapshotId: snapshot.manifest.snapshotId,
          rowCount: snapshot.manifest.projectionCount,
          rowDigest: snapshot.manifest.projectionDigest,
        }),
      };
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        t.mutation((ctx) => insertTestRelease(ctx, { snapshots }))
      );

      yield* Effect.promise(() =>
        expect(
          t.mutation(TEST_STAGE_SNAPSHOT, {
            releaseId: TEST_RELEASE_ID,
            snapshotJson: encodeSnapshotJson(snapshot),
          })
        ).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
        })
      );
      yield* Effect.promise(() =>
        expect(
          t.run((ctx) => ctx.db.query("contentSnapshots").unique())
        ).resolves.toBeNull()
      );
    })
  );

  it.live("rejects manifests after release staging closes", () =>
    Effect.gen(function* () {
      const data = yield* makeProgramSnapshotData();
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          insertTestRelease(ctx, {
            snapshots: data.snapshots,
            status: "verifying",
          })
        )
      );

      yield* Effect.promise(() =>
        expect(
          t.mutation(TEST_STAGE_SNAPSHOT, {
            releaseId: TEST_RELEASE_ID,
            snapshotJson: data.manifestJson,
          })
        ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } })
      );
    })
  );
});
