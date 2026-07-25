import { EMPTY_RESULT_CATALOG_DIGEST } from "@nakafa/aksara-contracts/release/result";
import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_DIGEST,
  testReleaseJson,
  testRendererJson,
} from "@repo/backend/test/content-release";
import {
  insertTestState,
  insertZeroRelease,
  type TestIdentity,
  zeroReleaseJson,
} from "@repo/backend/test/content-state";
import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, it } from "vitest";

const stageRelease = internal.contentRelease.manifest.stageRelease;
const stageRecovery = internal.contentRelease.manifest.stageRecovery;
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

/** Creates one empty genesis candidate envelope. */
function candidateJson(identity = CANDIDATE) {
  return testReleaseJson({
    itemCount: 0,
    manifestHash: identity.manifestHash,
    projectionCount: 0,
    releaseId: identity.releaseId,
    resultCount: 0,
    resultDigest: EMPTY_RESULT_CATALOG_DIGEST,
    routeCount: 0,
    upsertCount: 0,
  });
}

/** Creates the exact inverse envelope for the verified genesis candidate. */
function recoveryJson() {
  return testReleaseJson({
    baseManifestHash: CANDIDATE.manifestHash,
    baseReleaseId: CANDIDATE.releaseId,
    baseResultCount: 0,
    baseResultDigest: EMPTY_RESULT_CATALOG_DIGEST,
    itemCount: 0,
    manifestHash: RECOVERY.manifestHash,
    originReleaseId: CANDIDATE.releaseId,
    projectionCount: 0,
    releaseId: RECOVERY.releaseId,
    resultCount: 0,
    resultDigest: EMPTY_RESULT_CATALOG_DIGEST,
    routeCount: 0,
    upsertCount: 0,
  });
}

/** Stages and marks the zero-item candidate verified for recovery tests. */
async function stageVerifiedCandidate(t: TestConvex<typeof schema>) {
  await t.mutation(stageRelease, {
    releaseJson: candidateJson(),
    rendererJson: testRendererJson(),
  });
  await t.mutation(async (ctx) => {
    const release = await ctx.db.query("contentReleases").unique();
    if (!release) {
      throw new Error("Expected staged candidate.");
    }
    await ctx.db.patch("contentReleases", release._id, {
      proofAt: 1,
      proofJson: "{}",
      status: "verified",
      verifiedAt: 1,
    });
  });
}

describe("contentRelease/manifest", () => {
  it("stages one candidate idempotently and rejects another", async () => {
    const t = convexTest(schema, convexModules);
    const input = {
      releaseJson: candidateJson(),
      rendererJson: testRendererJson(),
    };

    const created = await t.mutation(stageRelease, input);
    const unchanged = await t.mutation(stageRelease, input);

    expect(created).toEqual({
      manifestHash: CANDIDATE.manifestHash,
      phase: "staging",
      releaseId: CANDIDATE.releaseId,
    });
    expect(unchanged).toEqual(created);
    await expect(
      t.mutation(stageRelease, {
        releaseJson: candidateJson({
          ...CANDIDATE,
          manifestHash: `sha256:${"8".repeat(64)}`,
          releaseId: "release-other",
        }),
        rendererJson: testRendererJson(),
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } });
  });

  it("stages only an exact inverse for the verified candidate", async () => {
    const t = convexTest(schema, convexModules);
    await stageVerifiedCandidate(t);

    await expect(
      t.mutation(stageRecovery, {
        releaseJson: recoveryJson(),
        rendererJson: testRendererJson(),
      })
    ).resolves.toEqual({
      manifestHash: RECOVERY.manifestHash,
      phase: "staging",
      releaseId: RECOVERY.releaseId,
    });
    await expect(
      t.mutation(stageRecovery, {
        releaseJson: recoveryJson(),
        rendererJson: testRendererJson(TEST_DIGEST, "h1"),
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } });
  });

  it("rejects inverse drift and recovery without a candidate", async () => {
    const missing = convexTest(schema, convexModules);
    await expect(
      missing.mutation(stageRecovery, {
        releaseJson: recoveryJson(),
        rendererJson: testRendererJson(),
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });

    const drift = convexTest(schema, convexModules);
    await stageVerifiedCandidate(drift);
    await expect(
      drift.mutation(stageRecovery, {
        releaseJson: testReleaseJson({
          baseManifestHash: CANDIDATE.manifestHash,
          baseReleaseId: CANDIDATE.releaseId,
          baseResultCount: 0,
          baseResultDigest: EMPTY_RESULT_CATALOG_DIGEST,
          itemCount: 0,
          manifestHash: RECOVERY.manifestHash,
          projectionCount: 0,
          releaseId: RECOVERY.releaseId,
          resultCount: 0,
          resultDigest: EMPTY_RESULT_CATALOG_DIGEST,
          routeCount: 0,
          upsertCount: 0,
        }),
        rendererJson: testRendererJson(),
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } });
  });

  it("rejects unsupported, oversized, and changed authenticated bytes", async () => {
    const unsupported = convexTest(schema, convexModules);
    await expect(
      unsupported.mutation(stageRelease, {
        releaseJson: candidateJson(),
        rendererJson: testRendererJson(`sha256:${"9".repeat(64)}`),
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_UNSUPPORTED" } });

    const oversized = convexTest(schema, convexModules);
    await expect(
      oversized.mutation(stageRelease, {
        releaseJson: candidateJson(),
        rendererJson: testRendererJson(TEST_DIGEST, `A${"a".repeat(270_000)}`),
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_SIZE" } });

    const changed = convexTest(schema, convexModules);
    await changed.mutation(stageRelease, {
      releaseJson: candidateJson(),
      rendererJson: testRendererJson(),
    });
    await expect(
      changed.mutation(stageRelease, {
        releaseJson: candidateJson(),
        rendererJson: testRendererJson(TEST_DIGEST, "h1"),
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_CONFLICT" } });
  });

  it("requires the exact active completed base", async () => {
    const stale = convexTest(schema, convexModules);
    const base = {
      manifestHash: `sha256:${"a".repeat(64)}`,
      releaseId: "release-base",
      sequence: 1,
    } satisfies TestIdentity;
    await stale.mutation(async (ctx) => {
      await insertZeroRelease(ctx, {
        ...base,
        role: "candidate",
        status: "completed",
      });
      await insertTestState(ctx, { active: base, nextSequence: 2 });
    });
    await expect(
      stale.mutation(stageRelease, {
        releaseJson: testReleaseJson({
          baseManifestHash: base.manifestHash,
          baseReleaseId: base.releaseId,
          baseResultCount: 1,
          baseResultDigest: TEST_DIGEST,
          itemCount: 0,
          manifestHash: CANDIDATE.manifestHash,
          projectionCount: 0,
          releaseId: CANDIDATE.releaseId,
          resultCount: 0,
          resultDigest: EMPTY_RESULT_CATALOG_DIGEST,
          routeCount: 0,
          upsertCount: 0,
        }),
        rendererJson: testRendererJson(),
      })
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STALE_BASE" } });
  });

  it("returns completed idempotently only while it remains active", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertZeroRelease(ctx, {
        ...CANDIDATE,
        role: "candidate",
        status: "completed",
      });
      await insertTestState(ctx, { active: CANDIDATE, nextSequence: 2 });
    });
    const input = {
      releaseJson: zeroReleaseJson({
        ...CANDIDATE,
        role: "candidate",
        status: "completed",
      }),
      rendererJson: testRendererJson(),
    };
    await expect(t.mutation(stageRelease, input)).resolves.toMatchObject({
      phase: "completed",
      releaseId: CANDIDATE.releaseId,
    });
    await t.mutation(async (ctx) => {
      const state = await ctx.db.query("contentState").unique();
      if (!state) {
        throw new Error("Expected active state.");
      }
      await ctx.db.patch("contentState", state._id, {
        activeReleaseId: "release-advanced",
      });
    });
    await expect(t.mutation(stageRelease, input)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STATE" },
    });
  });
});
