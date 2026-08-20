// @vitest-environment node

import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { ContentReleaseManifestSchema } from "@nakafa/aksara-contracts/release";
import {
  inheritContentSnapshots,
  invertContentSnapshots,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { verifyReleaseSnapshots } from "@repo/backend/convex/contentRelease/proof/snapshot";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testSignedRelease,
} from "@repo/backend/test/content-proof";
import { testPublicationScope } from "@repo/backend/test/content-release";
import type { ProgramSnapshotData } from "@repo/backend/test/program-snapshot";
import {
  makeProgramSnapshotData,
  stageProgramSnapshot,
} from "@repo/backend/test/program-snapshot";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

/** Signs one genesis release that replaces the technical program snapshot. */
function programRelease(data: ProgramSnapshotData, releaseId: string) {
  return testSignedRelease(
    ContentReleaseManifestSchema.make({
      ...testEmptyManifest(ReleaseIdSchema.make(releaseId)),
      scope: testPublicationScope({ snapshots: data.snapshots }),
      snapshots: data.snapshots,
    })
  );
}

/** Inserts one completed signed release used as a recovery proof base. */
function insertCompletedRelease(
  ctx: MutationCtx,
  release: ReturnType<typeof programRelease>,
  stagedSnapshotRows: number
) {
  return ctx.db.insert("contentReleases", {
    baseFamilies: [],
    checkedIndex: -1,
    checkedItems: 0,
    completedAt: 1,
    createdAt: 1,
    proofAt: 1,
    proofJson: "{}",
    releaseId: release.manifest.releaseId,
    releaseJson: JSON.stringify(release),
    rendererJson: JSON.stringify(TEST_PROOF_RENDERER),
    resultFamilies: [...release.manifest.scope.families],
    role: "candidate",
    sequence: 1,
    stagedArtifacts: 0,
    stagedDeletes: 0,
    stagedItems: 0,
    stagedProjections: 0,
    stagedRoutes: 0,
    stagedSnapshotBatches: 1,
    stagedSnapshotRows,
    stagedUpserts: 0,
    status: "completed",
    updatedAt: 1,
    verifiedAt: 1,
  });
}

describe("contentRelease/proof/snapshot", () => {
  it("replays all staged rows through the shared snapshot verifier", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const release = programRelease(data, "release-test");
    const t = convexTest(schema, convexModules);
    const batchSize = 3;
    const batchCount = Math.ceil(data.rowJson.length / batchSize);
    await stageProgramSnapshot(t, data, batchSize);

    await expect(
      t.action((ctx) =>
        runConvexProgram(
          verifyReleaseSnapshots(
            ctx,
            release,
            "candidate",
            batchCount,
            data.rowJson.length
          )
        )
      )
    ).resolves.toEqual({
      snapshots: data.snapshots,
      stagedRows: data.rowJson.length,
    });
    await expect(
      t.action((ctx) =>
        runConvexProgram(
          verifyReleaseSnapshots(
            ctx,
            release,
            "candidate",
            batchCount,
            data.rowJson.length - 1
          )
        )
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });

  it("rejects tampered physical rows during canonical proof replay", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const release = programRelease(data, "release-test");
    const t = convexTest(schema, convexModules);
    await stageProgramSnapshot(t, data);
    const secondRow = data.rowJson.at(1);
    if (!secondRow) {
      throw new Error("Expected a second program snapshot row.");
    }
    await t.mutation(async (ctx) => {
      const first = await ctx.db
        .query("programCatalog")
        .withIndex("by_snapshotId_and_index", (query) =>
          query.eq("snapshotId", data.snapshotId).eq("index", 0)
        )
        .unique();
      if (!first) {
        throw new Error("Expected first program row.");
      }
      await ctx.db.patch("programCatalog", first._id, {
        rowJson: secondRow,
      });
    });

    await expect(
      t.action((ctx) =>
        runConvexProgram(
          verifyReleaseSnapshots(
            ctx,
            release,
            "candidate",
            1,
            data.rowJson.length
          )
        )
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });

  it("accepts only the exact zero-copy inverse for rollback candidates and recovery", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const base = programRelease(data, "release-base");
    const rollbackSnapshots = invertContentSnapshots(base.manifest.snapshots);
    const rollbackManifest = ContentReleaseManifestSchema.make({
      ...testEmptyManifest(ReleaseIdSchema.make("release-recovery")),
      baseActiveAppLocales: base.manifest.activeAppLocales,
      baseManifestHash: base.manifestHash,
      baseReleaseId: base.manifest.releaseId,
      baseResultCount: base.manifest.resultCount,
      baseResultDigest: base.manifest.resultDigest,
      origin: { kind: "rollback", releaseId: base.manifest.releaseId },
      scope: testPublicationScope({ snapshots: rollbackSnapshots }),
      snapshots: rollbackSnapshots,
    });
    const rollback = testSignedRelease(rollbackManifest);
    const driftSnapshots = inheritContentSnapshots(null);
    const drift = testSignedRelease(
      ContentReleaseManifestSchema.make({
        ...rollbackManifest,
        scope: testPublicationScope({ snapshots: driftSnapshots }),
        snapshots: driftSnapshots,
      })
    );
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      insertCompletedRelease(ctx, base, data.rowJson.length)
    );

    await expect(
      t.action((ctx) =>
        runConvexProgram(
          verifyReleaseSnapshots(ctx, rollback, "candidate", 0, 0)
        )
      )
    ).resolves.toEqual({
      snapshots: rollback.manifest.snapshots,
      stagedRows: 0,
    });
    await expect(
      t.action((ctx) =>
        runConvexProgram(
          verifyReleaseSnapshots(ctx, rollback, "candidate", 1, 0)
        )
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
    await expect(
      t.action((ctx) =>
        runConvexProgram(
          verifyReleaseSnapshots(ctx, rollback, "recovery", 0, 0)
        )
      )
    ).resolves.toEqual({
      snapshots: rollback.manifest.snapshots,
      stagedRows: 0,
    });
    await expect(
      t.action((ctx) =>
        runConvexProgram(verifyReleaseSnapshots(ctx, drift, "recovery", 0, 0))
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });
});
