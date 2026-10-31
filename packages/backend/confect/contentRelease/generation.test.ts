import { describe, expect, it } from "@effect/vitest";
import { ContentFamilySchema } from "@nakafa/aksara-contracts/content";
import { EMPTY_RESULT_CATALOG_DIGEST } from "@nakafa/aksara-contracts/release/result/spec";
import { CURRENT_CONTENT_GENERATION } from "@repo/backend/confect/contentRelease/generation";
import { convexModules } from "@repo/backend/confect/test.setup";
import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import {
  REPLACEMENT_RECOVERY,
  seedReplacementCandidate,
} from "@repo/backend/test/activation/fixture";
import {
  testReleaseJson,
  testRendererJson,
} from "@repo/backend/test/content/release";
import {
  insertTestState,
  insertZeroRelease,
  type TestIdentity,
  zeroReleaseJson,
} from "@repo/backend/test/content/state";
import { convexTest, type TestConvex } from "convex-test";

const stageRelease = internal.contentRelease.manifest.stageRelease;
const stageRecovery = internal.contentRelease.manifest.stageRecovery;
const BASE = {
  manifestHash: `sha256:${"b".repeat(64)}`,
  releaseId: "release-base",
  sequence: 1,
} satisfies TestIdentity;
const CANDIDATE = {
  manifestHash: `sha256:${"c".repeat(64)}`,
  releaseId: "release-replacement",
  sequence: 2,
} satisfies TestIdentity;

/** The signed candidate that replaces the empty base with two upserted heads. */
function candidateJson() {
  return testReleaseJson({
    baseManifestHash: BASE.manifestHash,
    baseReleaseId: BASE.releaseId,
    baseResultCount: 0,
    baseResultDigest: EMPTY_RESULT_CATALOG_DIGEST,
    itemCount: 2,
    manifestHash: CANDIDATE.manifestHash,
    releaseId: CANDIDATE.releaseId,
    resultCount: 2,
    upsertCount: 2,
  });
}

/** Seeds the active base. A null generation leaves its generation unrecorded. */
async function seedBase(
  t: TestConvex<typeof schema>,
  generation: typeof CURRENT_CONTENT_GENERATION | null
) {
  await t.mutation(async (ctx) => {
    await insertZeroRelease(ctx, {
      ...BASE,
      ownership: { base: [], result: ContentFamilySchema.literals },
      role: "candidate",
      status: "completed",
    });
    await insertTestState(ctx, { active: BASE, generation, nextSequence: 2 });
  });
}

/** Reads one stored release by its identity. */
function readRelease(t: TestConvex<typeof schema>, releaseId: string) {
  return t.run((ctx) =>
    ctx.db
      .query("contentReleases")
      .withIndex("by_releaseId", (query) => query.eq("releaseId", releaseId))
      .unique()
  );
}

/** The zero-item inverse of the replacement candidate. */
function recoveryJson() {
  return zeroReleaseJson({
    ...REPLACEMENT_RECOVERY,
    base: CANDIDATE,
    originKind: "rollback",
    originReleaseId: CANDIDATE.releaseId,
    role: "recovery",
    status: "verified",
  });
}

describe("contentRelease/generation staging", () => {
  it("stages a candidate over an active release of the current generation", async () => {
    const t = convexTest(schema, convexModules);
    await seedBase(t, CURRENT_CONTENT_GENERATION);

    await t.mutation(stageRelease, {
      releaseJson: candidateJson(),
      rendererJson: testRendererJson(),
    });

    expect(await readRelease(t, CANDIDATE.releaseId)).toMatchObject({
      role: "candidate",
      status: "staging",
    });
  });

  it("refuses a candidate over an active release whose generation is not recorded", async () => {
    const t = convexTest(schema, convexModules);
    await seedBase(t, null);

    await expect(
      t.mutation(stageRelease, {
        releaseJson: candidateJson(),
        rendererJson: testRendererJson(),
      })
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_STATE",
        message: expect.stringContaining("is not recorded"),
      },
    });
    await expect(readRelease(t, CANDIDATE.releaseId)).resolves.toBeNull();
  });

  it("refuses a recovery over an active release whose generation is not recorded", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      seedReplacementCandidate(ctx, { generation: null })
    );

    await expect(
      t.mutation(stageRecovery, {
        releaseJson: recoveryJson(),
        rendererJson: testRendererJson(),
      })
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_STATE",
        message: expect.stringContaining("is not recorded"),
      },
    });
    await expect(
      readRelease(t, REPLACEMENT_RECOVERY.releaseId)
    ).resolves.toBeNull();
  });

  it("stages the recovery of a candidate over the current generation", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      seedReplacementCandidate(ctx, { generation: CURRENT_CONTENT_GENERATION })
    );

    await t.mutation(stageRecovery, {
      releaseJson: recoveryJson(),
      rendererJson: testRendererJson(),
    });

    expect(await readRelease(t, REPLACEMENT_RECOVERY.releaseId)).toMatchObject({
      role: "recovery",
      status: "staging",
    });
  });
});
