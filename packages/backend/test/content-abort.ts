import { ContentFamilySchema } from "@nakafa/aksara-contracts/content";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { RELEASE_PAGE_LIMIT } from "@repo/backend/convex/contentRelease/spec";
import {
  TEST_MANIFEST_HASH,
  testReleaseJson,
  testRendererJson,
  testRollbackJson,
} from "@repo/backend/test/content-release";

export const ABORT_RELEASE_ID = "release-abort";
export const ABORT_ITEM_COUNT = RELEASE_PAGE_LIMIT + 1;
export const ABORT_BATCH_HASH = `sha256:${"0".repeat(64)}`;

/** Creates one deterministic technical content key for abort tests. */
export function abortContentKey(index: number) {
  return `test:abort-${index.toString().padStart(3, "0")}`;
}

/** Creates one staged upsert body with no authored educational content. */
export function abortItemJson(index: number) {
  const contentKey = abortContentKey(index);
  return JSON.stringify({
    change: {
      artifactHash: `sha256:${index.toString(16).padStart(64, "0")}`,
      contentKey,
      delivery: "public",
      locale: "en",
      operation: "upsert",
      rendererDomain: "mathematics",
      sourcePath: `packages/corpus/test/abort-${index}/en.mdx`,
    },
    index,
    releaseId: ABORT_RELEASE_ID,
  });
}

/** Seeds one invisible staged candidate spanning two abort pages. */
export async function seedAbortRelease(ctx: MutationCtx) {
  const now = Date.UTC(2026, 6, 23, 12);
  await ctx.db.insert("contentReleases", {
    baseFamilies: [],
    checkedIndex: -1,
    checkedItems: 0,
    createdAt: now,
    releaseId: ABORT_RELEASE_ID,
    releaseJson: testReleaseJson({
      itemCount: ABORT_ITEM_COUNT,
      projectionCount: 0,
      releaseId: ABORT_RELEASE_ID,
      routeCount: 0,
      upsertCount: ABORT_ITEM_COUNT,
    }),
    rendererJson: testRendererJson(),
    resultFamilies: [...ContentFamilySchema.literals],
    role: "candidate",
    sequence: 1,
    stagedArtifacts: 0,
    stagedDeletes: 0,
    stagedItems: ABORT_ITEM_COUNT,
    stagedProjections: 0,
    stagedRoutes: 0,
    stagedSnapshotBatches: 0,
    stagedSnapshotRows: 0,
    stagedUpserts: ABORT_ITEM_COUNT,
    status: "staging",
    updatedAt: now,
  });
  await ctx.db.insert("contentState", {
    candidateManifestHash: TEST_MANIFEST_HASH,
    candidateReleaseId: ABORT_RELEASE_ID,
    candidateSequence: 1,
    key: "primary",
    nextSequence: 2,
    updatedAt: now,
  });
  for (let index = 0; index < ABORT_ITEM_COUNT; index += 1) {
    const contentKey = abortContentKey(index);
    await ctx.db.insert("contentItems", {
      artifactReady: false,
      contentKey,
      index,
      itemBatchHash: ABORT_BATCH_HASH,
      itemBatchIndex: 0,
      itemJson: abortItemJson(index),
      locale: "en",
      projectionReady: false,
      releaseId: ABORT_RELEASE_ID,
      rollbackJson: testRollbackJson({
        contentKey,
        index,
        releaseId: ABORT_RELEASE_ID,
      }),
      sequence: 1,
      stagedAt: now,
    });
  }
}
