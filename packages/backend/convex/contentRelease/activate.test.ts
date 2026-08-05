import { ContentFamilySchema } from "@nakafa/aksara-contracts/content";
import { EMPTY_RESULT_CATALOG_DIGEST } from "@nakafa/aksara-contracts/release/result/spec";
import type { ContentSnapshotSet } from "@nakafa/aksara-contracts/release/snapshot/spec";
import {
  inheritContentSnapshots,
  invertContentSnapshots,
  replaceContentSnapshot,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_DIGEST,
  testRendererJson,
} from "@repo/backend/test/content-release";
import {
  insertTestState,
  insertZeroRelease,
  type TestIdentity,
} from "@repo/backend/test/content-state";
import { insertReleaseItem } from "@repo/backend/test/content-sync";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CANDIDATE = {
  manifestHash: `sha256:${"6".repeat(64)}`,
  releaseId: "release-candidate",
  sequence: 1,
} satisfies TestIdentity;
const RECOVERY = {
  manifestHash: `sha256:${"7".repeat(64)}`,
  releaseId: "release-recovery",
  sequence: 2,
} satisfies TestIdentity;

const activate = internal.contentRelease.activate.activate;
const activateRecovery = internal.contentRelease.activate.activateRecovery;

/** Seeds one verified genesis candidate and its exact verified inverse. */
async function seedVerifiedPair(
  ctx: Parameters<typeof insertTestState>[0],
  snapshots?: {
    readonly candidate: ContentSnapshotSet;
    readonly recovery: ContentSnapshotSet;
  }
) {
  await insertZeroRelease(ctx, {
    ...CANDIDATE,
    ownership: {
      base: [],
      result: ContentFamilySchema.literals,
    },
    role: "candidate",
    snapshots: snapshots?.candidate,
    status: "verified",
  });
  await insertZeroRelease(ctx, {
    ...RECOVERY,
    base: CANDIDATE,
    originReleaseId: CANDIDATE.releaseId,
    ownership: {
      base: ContentFamilySchema.literals,
      result: [],
    },
    role: "recovery",
    snapshots: snapshots?.recovery,
    status: "verified",
  });
  await insertTestState(ctx, {
    candidate: CANDIDATE,
    nextSequence: 3,
    recovery: RECOVERY,
  });
}

/** Builds the exact terminal receipt expected for one technical identity. */
function expectedReceipt(identity: TestIdentity) {
  return {
    activatedHeads: 0,
    deletedHeads: 0,
    manifestHash: identity.manifestHash,
    projectionDigest: TEST_DIGEST,
    releaseId: identity.releaseId,
    resultCount: 0,
    resultDigest: EMPTY_RESULT_CATALOG_DIGEST,
    routeDigest: TEST_DIGEST,
    snapshots: inheritContentSnapshots(null),
    stagedArtifacts: 0,
    stagedItems: 0,
    stagedProjections: 0,
    stagedRoutes: 0,
    stagedSnapshotRows: 0,
  };
}

describe("contentRelease/activate", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("atomically activates a candidate while retaining its inverse", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(seedVerifiedPair);

    const receipt = await t.mutation(activate, {
      manifestHash: CANDIDATE.manifestHash,
      releaseId: CANDIDATE.releaseId,
      rendererJson: testRendererJson(),
    });
    const pending = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );
    expect(pending).toEqual([
      expect.objectContaining({
        name: expect.stringContaining("contentRelease/models:resume"),
        state: { kind: "pending" },
      }),
    ]);

    const repeatedPending = await t.mutation(activate, {
      manifestHash: CANDIDATE.manifestHash,
      releaseId: CANDIDATE.releaseId,
      rendererJson: testRendererJson(),
    });
    const deduplicated = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );
    expect(deduplicated).toHaveLength(1);

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const completedJobs = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );
    expect(completedJobs).toHaveLength(3);
    expect(completedJobs.every(({ state }) => state.kind === "success")).toBe(
      true
    );

    const repeated = await t.mutation(activate, {
      manifestHash: CANDIDATE.manifestHash,
      releaseId: CANDIDATE.releaseId,
      rendererJson: testRendererJson(),
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const state = await t.run((ctx) => ctx.db.query("contentState").unique());

    expect(receipt).toEqual(expectedReceipt(CANDIDATE));
    expect(repeatedPending).toEqual(receipt);
    expect(repeated).toEqual(receipt);
    expect(state).toMatchObject({
      activeManifestHash: CANDIDATE.manifestHash,
      activeReleaseId: CANDIDATE.releaseId,
      activeSequence: CANDIDATE.sequence,
      articleReleaseId: CANDIDATE.releaseId,
      materialReleaseId: CANDIDATE.releaseId,
      recoveryReleaseId: RECOVERY.releaseId,
      searchReleaseId: CANDIDATE.releaseId,
    });
    expect(state?.candidateReleaseId).toBeUndefined();
  });

  it("retains and repairs the active release try-out bundle", async () => {
    const t = convexTest(schema, convexModules);
    const candidate = {
      ...inheritContentSnapshots(null),
      tryout: replaceContentSnapshot({
        baseSnapshotId: null,
        resultSnapshotId: TEST_DIGEST,
        rowCount: 1,
        rowDigest: TEST_DIGEST,
      }),
    };
    await t.mutation((ctx) =>
      seedVerifiedPair(ctx, {
        candidate,
        recovery: invertContentSnapshots(candidate),
      })
    );

    await t.mutation(activate, {
      manifestHash: CANDIDATE.manifestHash,
      releaseId: CANDIDATE.releaseId,
      rendererJson: testRendererJson(),
    });
    const retained = await t.run((ctx) =>
      ctx.db.query("tryoutBundles").unique()
    );
    expect(retained).toMatchObject({
      manifestHash: CANDIDATE.manifestHash,
      releaseId: CANDIDATE.releaseId,
      snapshotId: TEST_DIGEST,
    });

    await t.mutation(async (ctx) => {
      const bundle = await ctx.db.query("tryoutBundles").unique();
      if (!bundle) {
        expect.fail("Expected one retained try-out bundle.");
      }
      await ctx.db.delete("tryoutBundles", bundle._id);
    });
    await t.mutation(activate, {
      manifestHash: CANDIDATE.manifestHash,
      releaseId: CANDIDATE.releaseId,
      rendererJson: testRendererJson(),
    });

    await expect(
      t.run((ctx) => ctx.db.query("tryoutBundles").collect())
    ).resolves.toEqual([
      expect.objectContaining({
        manifestHash: CANDIDATE.manifestHash,
        releaseId: CANDIDATE.releaseId,
        snapshotId: TEST_DIGEST,
      }),
    ]);
  });

  it("atomically activates the retained inverse and clears its slot", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(seedVerifiedPair);
    await t.mutation(activate, {
      manifestHash: CANDIDATE.manifestHash,
      releaseId: CANDIDATE.releaseId,
      rendererJson: testRendererJson(),
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const receipt = await t.mutation(activateRecovery, {
      manifestHash: RECOVERY.manifestHash,
      releaseId: RECOVERY.releaseId,
      rendererJson: testRendererJson(),
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const state = await t.run((ctx) => ctx.db.query("contentState").unique());

    expect(receipt).toEqual(expectedReceipt(RECOVERY));
    expect(state).toMatchObject({
      activeManifestHash: RECOVERY.manifestHash,
      activeReleaseId: RECOVERY.releaseId,
      activeSequence: RECOVERY.sequence,
      articleReleaseId: RECOVERY.releaseId,
      searchReleaseId: RECOVERY.releaseId,
    });
    expect(state?.recoveryReleaseId).toBeUndefined();
  });

  it("rejects activation without the exact verified retained inverse", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(seedVerifiedPair);
    await t.mutation(async (ctx) => {
      const state = await ctx.db.query("contentState").unique();
      if (!state) {
        throw new Error("Expected content state.");
      }
      await ctx.db.patch("contentState", state._id, {
        recoveryManifestHash: undefined,
        recoveryReleaseId: undefined,
        recoverySequence: undefined,
      });
    });

    await expect(
      t.mutation(activate, {
        manifestHash: CANDIDATE.manifestHash,
        releaseId: CANDIDATE.releaseId,
        rendererJson: testRendererJson(),
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });
  });

  it("restarts a failed model lineage under one new generation", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await seedVerifiedPair(ctx);
      await insertReleaseItem(ctx, CANDIDATE, "test:unexpected", 0);
    });

    await t.mutation(activate, {
      manifestHash: CANDIDATE.manifestHash,
      releaseId: CANDIDATE.releaseId,
      rendererJson: testRendererJson(),
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const failed = await t.run(async (ctx) => ({
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
      release: await ctx.db
        .query("contentReleases")
        .withIndex("by_releaseId", (index) =>
          index.eq("releaseId", CANDIDATE.releaseId)
        )
        .unique(),
      state: await ctx.db.query("contentState").unique(),
    }));

    expect(failed.jobs).toEqual([
      expect.objectContaining({
        state: expect.objectContaining({ kind: "failed" }),
      }),
    ]);
    expect(failed.release).toMatchObject({
      status: "completed",
      syncGeneration: 1,
    });
    expect(failed.state?.activeReleaseId).toBe(CANDIDATE.releaseId);
    expect(failed.state?.articleReleaseId).toBeUndefined();
    expect(failed.state?.materialReleaseId).toBeUndefined();
    expect(failed.state?.searchReleaseId).toBeUndefined();

    await t.mutation(activate, {
      manifestHash: CANDIDATE.manifestHash,
      releaseId: CANDIDATE.releaseId,
      rendererJson: testRendererJson(),
    });
    const restarted = await t.run(async (ctx) => ({
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
      release: await ctx.db
        .query("contentReleases")
        .withIndex("by_releaseId", (index) =>
          index.eq("releaseId", CANDIDATE.releaseId)
        )
        .unique(),
    }));

    expect(restarted.jobs).toHaveLength(2);
    expect(restarted.jobs.at(-1)?.state).toEqual({ kind: "pending" });
    expect(restarted.release?.syncGeneration).toBe(2);
  });

  it("resumes an owner projection added after completed activation", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(seedVerifiedPair);
    await t.mutation(activate, {
      manifestHash: CANDIDATE.manifestHash,
      releaseId: CANDIDATE.releaseId,
      rendererJson: testRendererJson(),
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await t.mutation(async (ctx) => {
      const state = await ctx.db.query("contentState").unique();
      if (!state) {
        expect.fail("Expected one active content state.");
      }
      await ctx.db.patch("contentState", state._id, {
        materialOwnerManifestHash: undefined,
        materialOwnerReleaseId: undefined,
        materialOwnerSequence: undefined,
      });
    });

    await t.mutation(activate, {
      manifestHash: CANDIDATE.manifestHash,
      releaseId: CANDIDATE.releaseId,
      rendererJson: testRendererJson(),
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    await expect(
      t.run((ctx) => ctx.db.query("contentState").unique())
    ).resolves.toMatchObject({
      materialOwnerManifestHash: CANDIDATE.manifestHash,
      materialOwnerReleaseId: CANDIDATE.releaseId,
      materialOwnerSequence: CANDIDATE.sequence,
    });
  });

  it("rejects cumulative exact material overflow before moving the pointer", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await seedVerifiedPair(ctx);
      const release = await ctx.db
        .query("contentReleases")
        .withIndex("by_releaseId", (index) =>
          index.eq("releaseId", CANDIDATE.releaseId)
        )
        .unique();
      if (!release) {
        expect.fail("Expected one candidate release.");
      }
      await ctx.db.patch("contentReleases", release._id, {
        resultFamilies: ["article"],
      });
      for (let index = 0; index < 64; index += 1) {
        await ctx.db.insert("materialOwners", {
          contentKey: `material/lesson/test/stored-${index}`,
          locale: "en",
          releaseId: "release-prior",
          sequence: 0,
        });
      }
      await ctx.db.insert("contentOwners", {
        contentKey: "material/lesson/test/next",
        family: "material",
        locale: "en",
        managed: true,
        releaseId: CANDIDATE.releaseId,
        sequence: CANDIDATE.sequence,
      });
    });

    await expect(
      t.mutation(activate, {
        manifestHash: CANDIDATE.manifestHash,
        releaseId: CANDIDATE.releaseId,
        rendererJson: testRendererJson(),
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
    const state = await t.run((ctx) => ctx.db.query("contentState").unique());
    expect(state?.activeReleaseId).toBeUndefined();
    expect(state?.candidateReleaseId).toBe(CANDIDATE.releaseId);
  });

  it("rejects renderer drift and a stale active base", async () => {
    const renderer = convexTest(schema, convexModules);
    await renderer.mutation(seedVerifiedPair);
    await expect(
      renderer.mutation(activate, {
        manifestHash: CANDIDATE.manifestHash,
        releaseId: CANDIDATE.releaseId,
        rendererJson: testRendererJson(`sha256:${"8".repeat(64)}`),
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_UNSUPPORTED" } });

    const stale = convexTest(schema, convexModules);
    const base = {
      manifestHash: `sha256:${"9".repeat(64)}`,
      releaseId: "release-base",
      sequence: 1,
    } satisfies TestIdentity;
    const candidate = { ...CANDIDATE, sequence: 2 };
    const recovery = { ...RECOVERY, sequence: 3 };
    await stale.mutation(async (ctx) => {
      await insertZeroRelease(ctx, {
        ...candidate,
        base,
        ownership: {
          base: ContentFamilySchema.literals,
          result: ContentFamilySchema.literals,
        },
        role: "candidate",
        status: "verified",
      });
      await insertZeroRelease(ctx, {
        ...recovery,
        base: candidate,
        originReleaseId: candidate.releaseId,
        ownership: {
          base: ContentFamilySchema.literals,
          result: ContentFamilySchema.literals,
        },
        role: "recovery",
        status: "verified",
      });
      await insertTestState(ctx, {
        active: { ...base, manifestHash: `sha256:${"a".repeat(64)}` },
        candidate,
        nextSequence: 4,
        recovery,
      });
    });
    await expect(
      stale.mutation(activate, {
        manifestHash: candidate.manifestHash,
        releaseId: candidate.releaseId,
        rendererJson: testRendererJson(),
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STALE_BASE" } });
  });
});
