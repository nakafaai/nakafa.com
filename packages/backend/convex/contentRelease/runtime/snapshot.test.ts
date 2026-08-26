import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import {
  inheritContentSnapshots,
  replaceContentSnapshot,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import {
  loadActiveSnapshot,
  loadSnapshotOwner,
} from "@repo/backend/convex/contentRelease/runtime/snapshot";
import { encodeSnapshotJson } from "@repo/backend/convex/contentRelease/wire";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
} from "@repo/backend/test/content-release";
import { insertTestRelease } from "@repo/backend/test/content-stage";
import {
  makeProgramSnapshotData,
  type ProgramSnapshotData,
  stageProgramSnapshot,
} from "@repo/backend/test/program-snapshot";
import {
  activateQuranSource,
  makeBlockedQuranSnapshot,
} from "@repo/backend/test/quran/snapshot";
import { describe, expect, it } from "@repo/testing/effect";
import type { TestConvex } from "convex-test";
import { convexTest } from "convex-test";
import { Effect } from "effect";

/** Promotes the staged technical release to the exact active identity. */
async function activateProgram(
  t: TestConvex<typeof schema>,
  data: ProgramSnapshotData,
  verified: boolean
) {
  await stageProgramSnapshot(t, data);
  await t.mutation(async (ctx) => {
    const [release, state, snapshot] = await Promise.all([
      ctx.db.query("contentReleases").unique(),
      ctx.db.query("contentState").unique(),
      ctx.db.query("contentSnapshots").unique(),
    ]);
    if (!(release && state && snapshot)) {
      throw new Error("Expected staged snapshot release.");
    }
    await ctx.db.patch("contentReleases", release._id, {
      completedAt: 1,
      status: "completed",
    });
    await ctx.db.patch("contentSnapshots", snapshot._id, {
      verifiedAt: verified ? 1 : undefined,
    });
    await ctx.db.patch("contentState", state._id, {
      activeManifestHash: TEST_MANIFEST_HASH,
      activeReleaseId: TEST_RELEASE_ID,
      activeSequence: 1,
      candidateManifestHash: undefined,
      candidateReleaseId: undefined,
      candidateSequence: undefined,
    });
  });
}

describe("contentRelease/runtime/snapshot", () => {
  it("returns empty ownership before any active release exists", async () => {
    const t = convexTest(schema, convexModules);
    await expect(
      t.query((ctx) => runConvexProgram(loadActiveSnapshot(ctx, "program")))
    ).resolves.toBeNull();
    await expect(
      t.query((ctx) => runConvexProgram(loadSnapshotOwner(ctx, "program")))
    ).resolves.toEqual({ active: null, snapshot: null, snapshotId: null });
  });

  it("preserves an active release that does not own the requested snapshot", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(activateQuranSource);

    await expect(
      t.query((ctx) => runConvexProgram(loadSnapshotOwner(ctx, "quran")))
    ).resolves.toMatchObject({
      active: { releaseId: TEST_RELEASE_ID },
      snapshot: null,
      snapshotId: null,
    });
    await expect(
      t.query((ctx) => runConvexProgram(loadActiveSnapshot(ctx, "quran")))
    ).resolves.toBeNull();
  });

  it.live(
    "selects only the verified manifest signed by the active release",
    () =>
      Effect.gen(function* () {
        const data = yield* makeProgramSnapshotData();
        const missing = convexTest(schema, convexModules);
        yield* Effect.promise(() => activateProgram(missing, data, false));
        yield* Effect.promise(() =>
          expect(
            missing.query((ctx) =>
              runConvexProgram(loadActiveSnapshot(ctx, "program"))
            )
          ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_MISSING" } })
        );

        const active = convexTest(schema, convexModules);
        yield* Effect.promise(() => activateProgram(active, data, true));
        yield* Effect.promise(() =>
          expect(
            active.query((ctx) =>
              runConvexProgram(loadActiveSnapshot(ctx, "program"))
            )
          ).resolves.toMatchObject({
            snapshot: data.snapshot,
            snapshotId: data.snapshotId,
          })
        );
      })
  );

  it.live("rejects a verified manifest whose stored identity drifted", () =>
    Effect.gen(function* () {
      const data = yield* makeProgramSnapshotData();
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() => activateProgram(t, data, true));
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const stored = await ctx.db.query("contentSnapshots").unique();
          if (!stored) {
            throw new Error("Expected active program snapshot.");
          }
          await ctx.db.patch("contentSnapshots", stored._id, {
            snapshotJson: encodeSnapshotJson({
              family: "program",
              manifest: {
                ...data.snapshot.manifest,
                snapshotId: Sha256HashSchema.make(`sha256:${"9".repeat(64)}`),
              },
            }),
          });
        })
      );

      yield* Effect.promise(() =>
        expect(
          t.query((ctx) => runConvexProgram(loadActiveSnapshot(ctx, "program")))
        ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } })
      );
    })
  );

  it("rejects blocked Quran provenance even if a stored row is marked verified", async () => {
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
    await t.mutation(async (ctx) => {
      const [release, state] = await Promise.all([
        ctx.db.query("contentReleases").unique(),
        ctx.db.query("contentState").unique(),
      ]);
      if (!(release && state)) {
        throw new Error("Expected blocked Quran release.");
      }
      await ctx.db.insert("contentSnapshots", {
        createdAt: 1,
        family: "quran",
        retainUntil: Number.MAX_SAFE_INTEGER,
        snapshotId: snapshot.manifest.snapshotId,
        snapshotJson: encodeSnapshotJson(snapshot),
        verifiedAt: 1,
      });
      await ctx.db.patch("contentReleases", release._id, {
        completedAt: 1,
        status: "completed",
      });
      await ctx.db.patch("contentState", state._id, {
        activeManifestHash: TEST_MANIFEST_HASH,
        activeReleaseId: TEST_RELEASE_ID,
        activeSequence: 1,
        candidateManifestHash: undefined,
        candidateReleaseId: undefined,
        candidateSequence: undefined,
      });
    });

    await expect(
      t.query((ctx) => runConvexProgram(loadActiveSnapshot(ctx, "quran")))
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_UNSUPPORTED" } });
  });
});
