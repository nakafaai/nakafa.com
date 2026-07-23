import {
  CorpusSourcePathSchema,
  GitCommitShaSchema,
  PublicPathSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { digestProjections } from "@nakafa/aksara-contracts/projection/digest";
import {
  canonicalizeMaterialProjection,
  MaterialKeySchema,
  MaterialLessonProjectionSchema,
  MaterialSectionSchema,
} from "@nakafa/aksara-contracts/projection/material";
import {
  ContentReleaseItemSchema,
  ContentReleaseManifestSchema,
} from "@nakafa/aksara-contracts/release";
import { digestItems } from "@nakafa/aksara-contracts/release/digest";
import { MaterialHeadSchema } from "@nakafa/aksara-contracts/release/head";
import { EMPTY_RESULT_CATALOG_DIGEST } from "@nakafa/aksara-contracts/release/result";
import { digestResultCatalog } from "@nakafa/aksara-contracts/release/result-digest";
import { RollbackSnapshotEntrySchema } from "@nakafa/aksara-contracts/release/rollback";
import { digestRollbackSnapshot } from "@nakafa/aksara-contracts/release/rollback-digest";
import { ContentRouteItemSchema } from "@nakafa/aksara-contracts/release/route";
import { digestRoutes } from "@nakafa/aksara-contracts/release/route-digest";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testSignedArtifact,
  testSignedRelease,
} from "@repo/backend/test/content-proof";
import { testTextHash } from "@repo/backend/test/content-release";
import { Effect, Stream } from "effect";

export const ingressReleaseId = ReleaseIdSchema.make("release-ingress");
export const ingressArtifact = testSignedArtifact();
const publicPath = PublicPathSchema.make("test/head-0");
const sourcePath = CorpusSourcePathSchema.make(
  "packages/corpus/test/head-0/en.mdx"
);

export const ingressItem = ContentReleaseItemSchema.make({
  change: {
    artifactHash: ingressArtifact.artifactHash,
    contentKey: ingressArtifact.payload.contentKey,
    delivery: "public",
    locale: ingressArtifact.payload.locale,
    operation: "upsert",
    rendererDomain: ingressArtifact.payload.rendererDomain,
    sourcePath,
  },
  index: 0,
  releaseId: ingressReleaseId,
});

export const ingressRoute = ContentRouteItemSchema.make({
  change: {
    contentKey: ingressItem.change.contentKey,
    locale: ingressItem.change.locale,
    operation: "bind",
    publicPath,
  },
  index: 0,
  releaseId: ingressReleaseId,
});

export const ingressProjection = MaterialLessonProjectionSchema.make({
  contentKey: ingressArtifact.payload.contentKey,
  kind: "subject-lesson",
  locale: "en",
  materialKey: MaterialKeySchema.make("test.0"),
  metadata: {
    authors: [{ name: "Nakafa" }],
    date: "2026-07-22",
    title: "Technical Head",
  },
  order: 1,
  parentPath: PublicPathSchema.make("test"),
  publicPath,
  sectionKey: MaterialSectionSchema.make("head-0"),
  sitemap: true,
});

const itemDigest = Effect.runSync(
  digestItems(ingressReleaseId, Stream.make(ingressItem))
);
const projectionDigest = Effect.runSync(
  digestProjections(ingressReleaseId, Stream.make(ingressProjection))
);
const rollbackDigest = Effect.runSync(
  digestRollbackSnapshot(
    ingressReleaseId,
    Stream.make(
      RollbackSnapshotEntrySchema.make({
        index: 0,
        releaseId: ingressReleaseId,
        snapshot: {
          contentKey: ingressItem.change.contentKey,
          locale: ingressItem.change.locale,
          state: "absent",
        },
      })
    )
  )
);
const routeDigest = Effect.runSync(
  digestRoutes(ingressReleaseId, Stream.make(ingressRoute))
);
const ingressHead = MaterialHeadSchema.make({
  artifactHash: ingressArtifact.artifactHash,
  compilerConfigHash: ingressArtifact.payload.compilerConfigHash,
  contentKey: ingressItem.change.contentKey,
  delivery: "public",
  locale: ingressArtifact.payload.locale,
  projectionHash: testTextHash(
    canonicalizeMaterialProjection(ingressProjection)
  ),
  publicPath,
  rendererDomain: ingressArtifact.payload.rendererDomain,
  sourceHash: ingressArtifact.payload.sourceHash,
  sourcePath,
});
const resultDigest = Effect.runSync(
  digestResultCatalog(ingressReleaseId, Stream.make(ingressHead))
);

export const ingressRelease = testSignedRelease(
  ContentReleaseManifestSchema.make({
    baseManifestHash: null,
    baseReleaseId: null,
    baseResultCount: 0,
    baseResultDigest: EMPTY_RESULT_CATALOG_DIGEST,
    deleteCount: 0,
    itemCount: 1,
    itemsDigest: itemDigest.digest,
    origin: { kind: "git", sha: GitCommitShaSchema.make("a".repeat(40)) },
    projectionCount: 1,
    projectionDigest: projectionDigest.digest,
    releaseId: ingressReleaseId,
    rendererContractVersion: TEST_PROOF_RENDERER.rendererContractVersion,
    rendererManifestHash: TEST_PROOF_RENDERER.hash,
    resultCount: 1,
    resultDigest: resultDigest.digest,
    rollbackCount: 1,
    rollbackDigest: rollbackDigest.digest,
    routeCount: 1,
    routeDigest: routeDigest.digest,
    upsertCount: 1,
  })
);

export const ingressRecoveryId = ReleaseIdSchema.make("release-recovery");
export const ingressRecoveryItem = ContentReleaseItemSchema.make({
  change: {
    contentKey: ingressItem.change.contentKey,
    locale: ingressItem.change.locale,
    operation: "delete",
  },
  index: 0,
  releaseId: ingressRecoveryId,
});
export const ingressRecoveryRoute = ContentRouteItemSchema.make({
  change: {
    locale: ingressRoute.change.locale,
    operation: "delete",
    publicPath: ingressRoute.change.publicPath,
  },
  index: 0,
  releaseId: ingressRecoveryId,
});
const recoveryItems = Effect.runSync(
  digestItems(ingressRecoveryId, Stream.make(ingressRecoveryItem))
);
const recoveryProjections = Effect.runSync(
  digestProjections(ingressRecoveryId, Stream.empty)
);
const recoveryRollback = Effect.runSync(
  digestRollbackSnapshot(
    ingressRecoveryId,
    Stream.make(
      RollbackSnapshotEntrySchema.make({
        index: 0,
        releaseId: ingressRecoveryId,
        snapshot: { head: ingressHead, state: "material" },
      })
    )
  )
);
const recoveryRoutes = Effect.runSync(
  digestRoutes(ingressRecoveryId, Stream.make(ingressRecoveryRoute))
);

export const ingressRecovery = testSignedRelease(
  ContentReleaseManifestSchema.make({
    baseManifestHash: ingressRelease.manifestHash,
    baseReleaseId: ingressReleaseId,
    baseResultCount: 1,
    baseResultDigest: ingressRelease.manifest.resultDigest,
    deleteCount: 1,
    itemCount: 1,
    itemsDigest: recoveryItems.digest,
    origin: { kind: "rollback", releaseId: ingressReleaseId },
    projectionCount: 0,
    projectionDigest: recoveryProjections.digest,
    releaseId: ingressRecoveryId,
    rendererContractVersion: TEST_PROOF_RENDERER.rendererContractVersion,
    rendererManifestHash: TEST_PROOF_RENDERER.hash,
    resultCount: 0,
    resultDigest: EMPTY_RESULT_CATALOG_DIGEST,
    rollbackCount: 1,
    rollbackDigest: recoveryRollback.digest,
    routeCount: 1,
    routeDigest: recoveryRoutes.digest,
    upsertCount: 0,
  })
);

/** Inserts one detached terminal release for cleanup dispatch coverage. */
export async function insertAbortedRelease(ctx: MutationCtx) {
  const now = Date.UTC(2026, 6, 22, 12);
  await ctx.db.insert("contentReleases", {
    abortedAt: now,
    abortedRows: 0,
    abortingAt: now,
    checkedIndex: -1,
    checkedItems: 0,
    createdAt: now,
    releaseId: "release-cleanup-dispatch",
    releaseJson: "{}",
    rendererJson: "{}",
    role: "candidate",
    sequence: 1,
    stagedArtifacts: 0,
    stagedDeletes: 0,
    stagedItems: 0,
    stagedProjections: 0,
    stagedRoutes: 0,
    stagedUpserts: 0,
    status: "aborted",
    updatedAt: now,
  });
}

/** Inserts one authoritative active pointer used to reject a stale base. */
export async function insertActiveRelease(
  ctx: MutationCtx,
  activeReleaseId: string,
  signedReleaseId = activeReleaseId
) {
  const activeId = ReleaseIdSchema.make(signedReleaseId);
  const active = testSignedRelease(testEmptyManifest(activeId));
  const manifest = active.manifest;
  const now = Date.UTC(2026, 6, 22, 12);
  const receipt = {
    activatedHeads: 0,
    deletedHeads: 0,
    manifestHash: active.manifestHash,
    projectionDigest: manifest.projectionDigest,
    releaseId: activeReleaseId,
    resultCount: 0,
    resultDigest: EMPTY_RESULT_CATALOG_DIGEST,
    routeDigest: manifest.routeDigest,
    stagedArtifacts: 0,
    stagedItems: 0,
    stagedProjections: 0,
    stagedRoutes: 0,
  };
  await ctx.db.insert("contentReleases", {
    checkedIndex: -1,
    checkedItems: 0,
    completedAt: now,
    createdAt: now,
    proofAt: now,
    proofJson: "{}",
    receiptJson: JSON.stringify(receipt),
    releaseId: activeReleaseId,
    releaseJson: JSON.stringify(active),
    rendererJson: JSON.stringify(TEST_PROOF_RENDERER),
    role: "candidate",
    sequence: 1,
    stagedArtifacts: 0,
    stagedDeletes: 0,
    stagedItems: 0,
    stagedProjections: 0,
    stagedRoutes: 0,
    stagedUpserts: 0,
    status: "completed",
    updatedAt: now,
    verifiedAt: now,
  });
  await ctx.db.insert("contentState", {
    activeManifestHash: active.manifestHash,
    activeReleaseId,
    activeSequence: 1,
    key: "primary",
    nextSequence: 2,
    updatedAt: now,
  });
  return active.manifestHash;
}
