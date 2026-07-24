import {
  emptyContentSnapshots,
  replaceContentSnapshot,
} from "@nakafa/aksara-contracts/release/snapshot";
import { canonicalizeContentSnapshotManifest } from "@nakafa/aksara-contracts/release/snapshot-data";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { TEST_RELEASE_ID } from "@repo/backend/test/content-release";
import {
  makeBlockedQuranSnapshot,
  makeProgramSnapshotData,
  TEST_STAGE_SNAPSHOT,
} from "@repo/backend/test/content-snapshot";
import { insertTestRelease } from "@repo/backend/test/content-stage";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("contentRelease/snapshot/manifest", () => {
  it("stores one signed manifest with byte-identical retry semantics", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      insertTestRelease(ctx, { snapshots: data.snapshots })
    );

    await expect(
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
    });
    await expect(
      t.mutation(TEST_STAGE_SNAPSHOT, {
        releaseId: TEST_RELEASE_ID,
        snapshotJson: data.manifestJson,
      })
    ).resolves.toMatchObject({ created: 0, unchanged: 1 });
  });

  it("rejects unsigned replacement state and changed stored bytes", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const unsigned = convexTest(schema, convexModules);
    await unsigned.mutation((ctx) => insertTestRelease(ctx));
    await expect(
      unsigned.mutation(TEST_STAGE_SNAPSHOT, {
        releaseId: TEST_RELEASE_ID,
        snapshotJson: data.manifestJson,
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const changed = convexTest(schema, convexModules);
    await changed.mutation((ctx) =>
      insertTestRelease(ctx, { snapshots: data.snapshots })
    );
    await changed.mutation(TEST_STAGE_SNAPSHOT, {
      releaseId: TEST_RELEASE_ID,
      snapshotJson: data.manifestJson,
    });
    await changed.mutation(async (ctx) => {
      const stored = await ctx.db.query("contentSnapshots").unique();
      if (!stored) {
        throw new Error("Expected staged program snapshot.");
      }
      await ctx.db.patch("contentSnapshots", stored._id, {
        snapshotJson: `${stored.snapshotJson} `,
      });
    });
    await expect(
      changed.mutation(TEST_STAGE_SNAPSHOT, {
        releaseId: TEST_RELEASE_ID,
        snapshotJson: data.manifestJson,
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_CONFLICT" },
    });
  });

  it("rejects blocked Quran provenance before storing its manifest", async () => {
    const snapshot = makeBlockedQuranSnapshot();
    const snapshots = {
      ...emptyContentSnapshots(),
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
        snapshotJson: canonicalizeContentSnapshotManifest(snapshot),
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_UNSUPPORTED" },
    });
    await expect(
      t.run((ctx) => ctx.db.query("contentSnapshots").unique())
    ).resolves.toBeNull();
  });

  it("rejects manifests after release staging closes", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      insertTestRelease(ctx, {
        snapshots: data.snapshots,
        status: "verifying",
      })
    );

    await expect(
      t.mutation(TEST_STAGE_SNAPSHOT, {
        releaseId: TEST_RELEASE_ID,
        snapshotJson: data.manifestJson,
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });
  });
});
