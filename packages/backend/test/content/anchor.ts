import { SignedContentReleaseSchema } from "@nakafa/aksara-contracts/release";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { makePublicationReceipt } from "@repo/backend/convex/contentRelease/receipt";
import { insertTestHead } from "@repo/backend/test/content/head";
import {
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
  testReleaseJson,
  testRendererJson,
  testStoredReachability,
} from "@repo/backend/test/content/release";
import { insertTestState } from "@repo/backend/test/content/state";
import { Schema } from "effect";

/** Names one manifest field a retired content contract still carried. */
const RETIRED_MANIFEST_FIELD = "rendererContractVersion";

/**
 * Inserts one stored release row that a later release treats as its base.
 *
 * The row carries the completion facts a base anchor is proven with, so the
 * payload can be anything the generation that published it produced.
 */
export async function insertStoredAnchor(
  ctx: MutationCtx,
  options: {
    readonly complete?: boolean;
    readonly manifestHash?: string;
    readonly releaseId: string;
  }
) {
  const now = Date.UTC(2026, 7, 1, 12);
  const releaseJson = testReleaseJson({ releaseId: options.releaseId });
  await ctx.db.insert("contentReleases", {
    ...testStoredReachability(releaseJson),
    baseFamilies: [],
    checkedIndex: 0,
    checkedItems: 1,
    completedAt: now,
    createdAt: now,
    ...(options.manifestHash === undefined
      ? {}
      : { manifestHash: options.manifestHash }),
    proofAt: now,
    proofJson: "{}",
    receiptJson: "{}",
    releaseId: options.releaseId,
    releaseJson,
    rendererJson: testRendererJson(),
    resultFamilies: [],
    role: "candidate",
    sequence: 0,
    stagedArtifacts: 1,
    stagedDeletes: 0,
    stagedItems: 1,
    stagedProjections: 1,
    stagedRoutes: 1,
    stagedSnapshotBatches: 0,
    stagedSnapshotRows: 0,
    stagedUpserts: 1,
    status: (options.complete ?? true) ? "completed" : "verified",
    updatedAt: now,
    verifiedAt: now,
  });
}

/** Rewrites one stored anchor into a payload the current contract retired. */
export async function retireStoredAnchorPayload(
  ctx: MutationCtx,
  releaseId: string
) {
  const release = await ctx.db
    .query("contentReleases")
    .withIndex("by_releaseId", (query) => query.eq("releaseId", releaseId))
    .unique();
  if (!release) {
    throw new Error(`Expected stored anchor ${releaseId}.`);
  }
  const retired = JSON.parse(release.releaseJson) as {
    manifest: Record<string, unknown>;
  };
  await ctx.db.patch("contentReleases", release._id, {
    releaseJson: JSON.stringify({
      ...retired,
      manifest: { ...retired.manifest, [RETIRED_MANIFEST_FIELD]: "1.0.0" },
    }),
  });
}

/** Inserts one completed active release anchored on its exact signed base. */
export async function insertAnchoredActiveRelease(
  ctx: MutationCtx,
  options: {
    readonly baseManifestHash: string;
    readonly baseReleaseId: string;
  }
) {
  const now = Date.UTC(2026, 7, 1, 12);
  const activeJson = testReleaseJson({
    baseManifestHash: options.baseManifestHash,
    baseReleaseId: options.baseReleaseId,
    releaseId: TEST_RELEASE_ID,
  });
  const activeId = await ctx.db.insert("contentReleases", {
    ...testStoredReachability(activeJson),
    baseFamilies: [],
    checkedIndex: 0,
    checkedItems: 1,
    completedAt: now,
    createdAt: now,
    proofAt: now,
    proofJson: "{}",
    receiptJson: "{}",
    releaseId: TEST_RELEASE_ID,
    releaseJson: activeJson,
    rendererJson: testRendererJson(),
    resultFamilies: [],
    role: "candidate",
    sequence: 1,
    stagedArtifacts: 1,
    stagedDeletes: 0,
    stagedItems: 1,
    stagedProjections: 1,
    stagedRoutes: 1,
    stagedSnapshotBatches: 0,
    stagedSnapshotRows: 0,
    stagedUpserts: 1,
    status: "completed",
    updatedAt: now,
    verifiedAt: now,
  });
  const active = await ctx.db.get("contentReleases", activeId);
  if (!active) {
    throw new Error("Expected the anchored active release fixture.");
  }
  await ctx.db.patch("contentReleases", activeId, {
    receiptJson: JSON.stringify(
      makePublicationReceipt(
        active,
        Schema.decodeUnknownSync(SignedContentReleaseSchema)(
          JSON.parse(activeJson)
        )
      )
    ),
  });
  await insertTestState(ctx, {
    active: {
      manifestHash: TEST_MANIFEST_HASH,
      releaseId: TEST_RELEASE_ID,
      sequence: 1,
    },
    nextSequence: 2,
  });
  await insertTestHead(ctx, { contentKey: "test:anchored" });
}
