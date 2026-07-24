import {
  ContentKeySchema,
  CorpusSourcePathSchema,
  PublicPathSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  canonicalizeRollbackSnapshotEntry,
  RollbackSnapshotEntrySchema,
} from "@nakafa/aksara-contracts/release/rollback";
import { emptyContentSnapshots } from "@nakafa/aksara-contracts/release/snapshot";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { testArtifactJson } from "@repo/backend/test/content-artifact";
import {
  TEST_DIGEST,
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
  testProjectionJson,
  testRollbackJson,
  testRouteJson,
  testTextHash,
  testUpsertJson,
} from "@repo/backend/test/content-release";
import { insertTestRelease } from "@repo/backend/test/content-stage";

const NOW = Date.UTC(2026, 6, 23, 12);

/** Inserts one signed route owner into a rollback fixture. */
export function insertRoute(
  ctx: MutationCtx,
  fixture: {
    readonly contentKey: string;
    readonly index: number;
    readonly operation?: "bind" | "delete";
    readonly publicPath: string;
    readonly releaseId?: string;
    readonly sequence?: number;
  }
) {
  const operation = fixture.operation ?? "bind";
  const releaseId = fixture.releaseId ?? TEST_RELEASE_ID;
  const sequence = fixture.sequence ?? 1;

  return ctx.db.insert("contentBindings", {
    batchHash: TEST_DIGEST,
    batchIndex: 0,
    contentKey: fixture.contentKey,
    index: fixture.index,
    locale: "en",
    operation,
    publicPath: fixture.publicPath,
    releaseId,
    routeJson: testRouteJson({
      contentKey: fixture.contentKey,
      index: fixture.index,
      operation,
      publicPath: fixture.publicPath,
      releaseId,
    }),
    sequence,
  });
}

/** Produces one unique immutable artifact identity for a rollback fixture. */
export function rollbackArtifactHash(index: number, slot: "current" | "prior") {
  const offset = slot === "current" ? index + 1 : index + 100;
  return Sha256HashSchema.make(
    `sha256:${offset.toString(16).padStart(64, "0")}`
  );
}

/** Makes one release the completed active source for rollback preparation. */
export async function activateRollbackFixture(
  ctx: MutationCtx,
  itemCount: number,
  routeCount = itemCount
) {
  await insertTestRelease(ctx, {
    checkedIndex: itemCount - 1,
    checkedItems: itemCount,
    itemCount,
    projectionCount: itemCount,
    routeCount,
    stagedArtifacts: itemCount,
    stagedItems: itemCount,
    stagedProjections: itemCount,
    stagedRoutes: routeCount,
    stagedUpserts: itemCount,
  });
  const release = await ctx.db.query("contentReleases").unique();
  const state = await ctx.db.query("contentState").unique();
  if (!(release && state)) {
    throw new Error("Expected release fixtures.");
  }
  const receipt = {
    activatedHeads: itemCount,
    deletedHeads: 0,
    manifestHash: TEST_MANIFEST_HASH,
    projectionDigest: TEST_DIGEST,
    releaseId: TEST_RELEASE_ID,
    resultCount: itemCount,
    resultDigest: TEST_DIGEST,
    routeDigest: TEST_DIGEST,
    snapshots: emptyContentSnapshots(),
    stagedArtifacts: itemCount,
    stagedItems: itemCount,
    stagedProjections: itemCount,
    stagedRoutes: routeCount,
    stagedSnapshotRows: 0,
  };
  await ctx.db.patch("contentReleases", release._id, {
    completedAt: NOW,
    proofAt: NOW,
    proofJson: "{}",
    receiptJson: JSON.stringify(receipt),
    status: "completed",
    verifiedAt: NOW,
  });
  await ctx.db.patch("contentState", state._id, {
    activeManifestHash: TEST_MANIFEST_HASH,
    activeReleaseId: TEST_RELEASE_ID,
    activeSequence: release.sequence,
    candidateManifestHash: undefined,
    candidateReleaseId: undefined,
    candidateSequence: undefined,
  });
}

/** Inserts one immutable content version and its signed artifact. */
async function insertVersion(
  ctx: MutationCtx,
  options: {
    readonly artifactHash: string;
    readonly contentKey: string;
    readonly index: number;
    readonly projectionJson: string;
    readonly releaseId: string;
    readonly sequence: number;
    readonly sourcePath: string;
  },
  compiledCode: string
) {
  await ctx.db.insert("contentHeads", {
    artifactHash: options.artifactHash,
    compilerConfigHash: TEST_DIGEST,
    contentKey: options.contentKey,
    delivery: "public",
    family: "material",
    index: options.index,
    locale: "en",
    operation: "upsert",
    projectionHash: testTextHash(options.projectionJson),
    projectionJson: options.projectionJson,
    releaseId: options.releaseId,
    rendererDomain: "mathematics",
    sequence: options.sequence,
    sourceHash: TEST_DIGEST,
    sourcePath: options.sourcePath,
  });
  await ctx.db.insert("contentArtifacts", {
    artifactHash: options.artifactHash,
    artifactJson: testArtifactJson({
      artifactHash: options.artifactHash,
      compiledCode,
      contentKey: options.contentKey,
    }),
    createdAt: NOW,
    retainUntil: Number.MAX_SAFE_INTEGER,
  });
}

/** Inserts one exact current body plus its signed prior rollback state. */
export async function insertRollbackItem(
  ctx: MutationCtx,
  index: number,
  previousExists: boolean,
  compiledCode = "return {};"
) {
  const contentKey = ContentKeySchema.make(`test:head-${index}`);
  const currentHash = rollbackArtifactHash(index, "current");
  const currentPath = `test/head-${index}`;
  const currentProjection = testProjectionJson({
    contentKey,
    index,
    publicPath: currentPath,
  });
  const priorHash = rollbackArtifactHash(index, "prior");
  const priorPath = PublicPathSchema.make(`test/prior-${index}`);
  const priorProjection = testProjectionJson({
    contentKey,
    index,
    publicPath: priorPath,
  });
  const priorSourcePath = CorpusSourcePathSchema.make(
    `packages/corpus/test/prior-${index}/en.mdx`
  );
  const rollbackJson = previousExists
    ? canonicalizeRollbackSnapshotEntry(
        RollbackSnapshotEntrySchema.make({
          index,
          releaseId: TEST_RELEASE_ID,
          snapshot: {
            head: {
              artifactHash: priorHash,
              compilerConfigHash: Sha256HashSchema.make(TEST_DIGEST),
              contentKey,
              delivery: "public",
              family: "material",
              locale: "en",
              projectionHash: Sha256HashSchema.make(
                testTextHash(priorProjection)
              ),
              publicPath: priorPath,
              rendererDomain: "mathematics",
              sourceHash: Sha256HashSchema.make(TEST_DIGEST),
              sourcePath: priorSourcePath,
            },
            state: "material",
          },
        })
      )
    : testRollbackJson({ contentKey, index });
  await ctx.db.insert("contentItems", {
    artifactHash: currentHash,
    artifactBatchHash: TEST_DIGEST,
    artifactBatchIndex: 0,
    artifactReady: true,
    contentKey,
    index,
    itemBatchHash: TEST_DIGEST,
    itemBatchIndex: 0,
    itemJson: testUpsertJson({
      artifactHash: currentHash,
      contentKey,
      index,
    }),
    locale: "en",
    priorSequence: previousExists ? 0 : undefined,
    projectionBatchHash: TEST_DIGEST,
    projectionBatchIndex: 0,
    projectionJson: currentProjection,
    projectionReady: true,
    releaseId: TEST_RELEASE_ID,
    rollbackJson,
    sequence: 1,
    stagedAt: NOW,
  });
  await insertVersion(
    ctx,
    {
      artifactHash: currentHash,
      contentKey,
      index,
      projectionJson: currentProjection,
      releaseId: TEST_RELEASE_ID,
      sequence: 1,
      sourcePath: `packages/corpus/test/head-${index}/en.mdx`,
    },
    compiledCode
  );
  if (previousExists) {
    await insertVersion(
      ctx,
      {
        artifactHash: priorHash,
        contentKey,
        index,
        projectionJson: priorProjection,
        releaseId: "release-prior",
        sequence: 0,
        sourcePath: priorSourcePath,
      },
      compiledCode
    );
  }
}
