import { EMPTY_RESULT_CATALOG_DIGEST } from "@nakafa/aksara-contracts/release/result";
import { emptyContentSnapshots } from "@nakafa/aksara-contracts/release/snapshot";
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
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

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
async function seedVerifiedPair(ctx: Parameters<typeof insertTestState>[0]) {
  await insertZeroRelease(ctx, {
    ...CANDIDATE,
    role: "candidate",
    status: "verified",
  });
  await insertZeroRelease(ctx, {
    ...RECOVERY,
    base: CANDIDATE,
    originReleaseId: CANDIDATE.releaseId,
    role: "recovery",
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
    snapshots: emptyContentSnapshots(),
    stagedArtifacts: 0,
    stagedItems: 0,
    stagedProjections: 0,
    stagedRoutes: 0,
    stagedSnapshotRows: 0,
  };
}

describe("contentRelease/activate", () => {
  it("atomically activates a candidate while retaining its inverse", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(seedVerifiedPair);

    const receipt = await t.mutation(activate, {
      manifestHash: CANDIDATE.manifestHash,
      releaseId: CANDIDATE.releaseId,
      rendererJson: testRendererJson(),
    });
    const repeated = await t.mutation(activate, {
      manifestHash: CANDIDATE.manifestHash,
      releaseId: CANDIDATE.releaseId,
      rendererJson: testRendererJson(),
    });
    const state = await t.run((ctx) => ctx.db.query("contentState").unique());

    expect(receipt).toEqual(expectedReceipt(CANDIDATE));
    expect(repeated).toEqual(receipt);
    expect(state).toMatchObject({
      activeManifestHash: CANDIDATE.manifestHash,
      activeReleaseId: CANDIDATE.releaseId,
      activeSequence: CANDIDATE.sequence,
      recoveryReleaseId: RECOVERY.releaseId,
    });
    expect(state?.candidateReleaseId).toBeUndefined();
  });

  it("atomically activates the retained inverse and clears its slot", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(seedVerifiedPair);
    await t.mutation(activate, {
      manifestHash: CANDIDATE.manifestHash,
      releaseId: CANDIDATE.releaseId,
      rendererJson: testRendererJson(),
    });

    const receipt = await t.mutation(activateRecovery, {
      manifestHash: RECOVERY.manifestHash,
      releaseId: RECOVERY.releaseId,
      rendererJson: testRendererJson(),
    });
    const state = await t.run((ctx) => ctx.db.query("contentState").unique());

    expect(receipt).toEqual(expectedReceipt(RECOVERY));
    expect(state).toMatchObject({
      activeManifestHash: RECOVERY.manifestHash,
      activeReleaseId: RECOVERY.releaseId,
      activeSequence: RECOVERY.sequence,
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
        role: "candidate",
        status: "verified",
      });
      await insertZeroRelease(ctx, {
        ...recovery,
        base: candidate,
        originReleaseId: candidate.releaseId,
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
