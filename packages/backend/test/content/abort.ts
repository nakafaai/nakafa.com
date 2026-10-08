import { ContentFamilySchema } from "@nakafa/aksara-contracts/content";
import {
  ContentKeySchema,
  CorpusSourcePathSchema,
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { ArtifactLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { ContentReleaseItemSchema } from "@nakafa/aksara-contracts/release";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  TEST_MANIFEST_HASH,
  testReleaseJson,
  testRendererJson,
  testRollbackJson,
  testStoredReachability,
} from "@repo/backend/test/content/release";
import { Schema } from "effect";

const encodeItemJson = Schema.encodeSync(
  Schema.fromJsonString(ContentReleaseItemSchema)
);

export const ABORT_RELEASE_ID = "release-abort";
export const ABORT_ITEM_COUNT = 32;
export const ABORT_BATCH_HASH = `sha256:${"0".repeat(64)}`;

/** Creates one deterministic technical content key for abort tests. */
export function abortContentKey(index: number) {
  return `test:abort-${index.toString().padStart(3, "0")}`;
}

/** Creates one staged upsert body with no authored educational content. */
export function abortItemJson(index: number) {
  const contentKey = abortContentKey(index);
  return encodeItemJson({
    change: {
      artifactHash: Sha256HashSchema.make(
        `sha256:${index.toString(16).padStart(64, "0")}`
      ),
      artifactLocale: ArtifactLocaleSchema.make("en"),
      contentKey: ContentKeySchema.make(contentKey),
      delivery: "public",
      family: "material",
      operation: "upsert",
      rendererDomain: "mathematics",
      sourcePath: CorpusSourcePathSchema.make(
        `packages/corpus/test/abort-${index}/en.mdx`
      ),
    },
    index,
    releaseId: ReleaseIdSchema.make(ABORT_RELEASE_ID),
  });
}

/** Seeds one invisible candidate larger than the former eight-row ceiling. */
export async function seedAbortRelease(ctx: MutationCtx) {
  const now = Date.UTC(2026, 6, 23, 12);
  const releaseJson = testReleaseJson({
    itemCount: ABORT_ITEM_COUNT,
    projectionCount: 0,
    releaseId: ABORT_RELEASE_ID,
    routeCount: 0,
    upsertCount: ABORT_ITEM_COUNT,
  });
  await ctx.db.insert("contentReleases", {
    ...testStoredReachability(releaseJson),
    baseFamilies: [],
    checkedIndex: -1,
    checkedItems: 0,
    createdAt: now,
    releaseId: ABORT_RELEASE_ID,
    releaseJson,
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
    articleSlot: "blue",
    candidateManifestHash: TEST_MANIFEST_HASH,
    candidateReleaseId: ABORT_RELEASE_ID,
    candidateSequence: 1,
    key: "primary",
    materialSlot: "blue",
    nextSequence: 2,
    searchSlot: "blue",
    updatedAt: now,
  });
  for (let index = 0; index < ABORT_ITEM_COUNT; index += 1) {
    const contentKey = abortContentKey(index);
    await ctx.db.insert("contentKeys", {
      contentKey,
      createdSequence: 1,
      family: "material",
      artifactLocale: "en",
    });
    await ctx.db.insert("contentItems", {
      artifactReady: false,
      artifactLocale: "en",
      contentKey,
      index,
      itemBatchHash: ABORT_BATCH_HASH,
      itemBatchIndex: 0,
      itemJson: abortItemJson(index),
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
