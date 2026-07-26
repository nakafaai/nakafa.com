import { ContentKeySchema } from "@nakafa/aksara-contracts/ids";
import { EMPTY_RESULT_CATALOG_DIGEST } from "@nakafa/aksara-contracts/release/result";
import type { PublicationScope } from "@nakafa/aksara-contracts/release/snapshot";
import { internal } from "@repo/backend/convex/_generated/api";
import type schema from "@repo/backend/convex/schema";
import {
  testPublicationScope,
  testReleaseJson,
  testRendererJson,
} from "@repo/backend/test/content-release";
import type { TestIdentity } from "@repo/backend/test/content-state";
import type { TestConvex } from "convex-test";

export const TEST_OWNER_KEY = ContentKeySchema.make("test:owner");
export const TEST_OWNER_SCOPE = testPublicationScope({
  content: [
    {
      contentKey: TEST_OWNER_KEY,
      family: "material",
      locale: "en",
    },
  ],
  families: [],
});
export const TEST_OWNER_CANDIDATE = {
  manifestHash: `sha256:${"1".repeat(64)}`,
  releaseId: "release-owner-candidate",
  sequence: 1,
} satisfies TestIdentity;
export const TEST_OWNER_RECOVERY = {
  manifestHash: `sha256:${"2".repeat(64)}`,
  releaseId: "release-owner-recovery",
  sequence: 2,
} satisfies TestIdentity;

interface OwnerReleaseOptions {
  readonly base?: TestIdentity;
  readonly originReleaseId?: string;
  readonly scope: PublicationScope;
}

/** Creates one zero-body envelope whose signed scope owns exact identities. */
export function ownerReleaseJson(
  identity: TestIdentity,
  options: OwnerReleaseOptions
) {
  return testReleaseJson({
    baseManifestHash: options.base?.manifestHash ?? null,
    baseReleaseId: options.base?.releaseId ?? null,
    baseResultCount: 0,
    baseResultDigest: EMPTY_RESULT_CATALOG_DIGEST,
    itemCount: 0,
    manifestHash: identity.manifestHash,
    originReleaseId: options.originReleaseId,
    projectionCount: 0,
    releaseId: identity.releaseId,
    resultCount: 0,
    resultDigest: EMPTY_RESULT_CATALOG_DIGEST,
    routeCount: 0,
    scope: options.scope,
    upsertCount: 0,
  });
}

/** Marks one staged technical owner release verified for lifecycle tests. */
export async function markOwnerVerified(
  t: TestConvex<typeof schema>,
  releaseId: string
) {
  await t.mutation(async (ctx) => {
    const release = await ctx.db
      .query("contentReleases")
      .withIndex("by_releaseId", (query) => query.eq("releaseId", releaseId))
      .unique();
    if (!release) {
      throw new Error("Expected staged exact release.");
    }
    await ctx.db.patch("contentReleases", release._id, {
      proofAt: 1,
      proofJson: "{}",
      status: "verified",
      verifiedAt: 1,
    });
  });
}

/** Stages one candidate and gives it the evidence required by recovery. */
export async function stageVerifiedOwner(
  t: TestConvex<typeof schema>,
  identity: TestIdentity,
  releaseJson: string
) {
  await t.mutation(internal.contentRelease.manifest.stageRelease, {
    releaseJson,
    rendererJson: testRendererJson(),
  });
  await markOwnerVerified(t, identity.releaseId);
}
