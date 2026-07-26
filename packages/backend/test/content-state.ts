import type { ContentFamily } from "@nakafa/aksara-contracts/content";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { EMPTY_RESULT_CATALOG_DIGEST } from "@nakafa/aksara-contracts/release/result";
import type { PublicationScope } from "@nakafa/aksara-contracts/release/snapshot";
import { inheritContentSnapshots } from "@nakafa/aksara-contracts/release/snapshot";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testSignedRelease,
} from "@repo/backend/test/content-proof";
import {
  TEST_DIGEST,
  testReleaseJson,
  testRendererJson,
} from "@repo/backend/test/content-release";

export interface TestIdentity {
  readonly manifestHash: string;
  readonly releaseId: string;
  readonly sequence: number;
}

interface TestReleaseEnvelope extends TestIdentity {
  readonly base?: TestIdentity;
  readonly originReleaseId?: string;
  readonly role: "candidate" | "recovery";
  readonly scope?: PublicationScope;
  readonly status: "aborted" | "completed" | "verified";
}

interface TestReleaseOptions extends TestReleaseEnvelope {
  readonly ownership: {
    readonly base: readonly ContentFamily[];
    readonly result: readonly ContentFamily[];
  };
}

interface TestStateOptions {
  readonly active?: TestIdentity;
  readonly article?: TestIdentity;
  readonly candidate?: TestIdentity;
  readonly material?: TestIdentity;
  readonly nextSequence: number;
  readonly recovery?: TestIdentity;
  readonly search?: TestIdentity;
}

/** Creates the exact zero-item signed envelope used by lifecycle tests. */
export function zeroReleaseJson(options: TestReleaseEnvelope) {
  return testReleaseJson({
    baseManifestHash: options.base?.manifestHash ?? null,
    baseReleaseId: options.base?.releaseId ?? null,
    baseResultCount: 0,
    baseResultDigest: EMPTY_RESULT_CATALOG_DIGEST,
    itemCount: 0,
    manifestHash: options.manifestHash,
    originReleaseId: options.originReleaseId,
    projectionCount: 0,
    releaseId: options.releaseId,
    resultCount: 0,
    resultDigest: EMPTY_RESULT_CATALOG_DIGEST,
    routeCount: 0,
    scope: options.scope,
    upsertCount: 0,
  });
}

/** Inserts one exact zero-item release in a durable lifecycle phase. */
export async function insertZeroRelease(
  ctx: MutationCtx,
  options: TestReleaseOptions
) {
  const now = Date.UTC(2026, 6, 23, 12);
  const releaseJson = zeroReleaseJson(options);
  const terminal = options.status === "completed";
  const aborted = options.status === "aborted";
  const receipt = {
    activatedHeads: 0,
    deletedHeads: 0,
    manifestHash: options.manifestHash,
    projectionDigest: TEST_DIGEST,
    releaseId: options.releaseId,
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
  await ctx.db.insert("contentReleases", {
    ...(aborted
      ? { abortedAt: now, abortedRows: 0, abortingAt: now }
      : {
          proofAt: now,
          proofJson: "{}",
          verifiedAt: now,
        }),
    ...(terminal
      ? {
          completedAt: now,
          receiptJson: JSON.stringify(receipt),
        }
      : {}),
    baseFamilies: [...options.ownership.base],
    checkedIndex: -1,
    checkedItems: 0,
    createdAt: now,
    releaseId: options.releaseId,
    releaseJson,
    rendererJson: testRendererJson(),
    resultFamilies: [...options.ownership.result],
    role: options.role,
    sequence: options.sequence,
    stagedArtifacts: 0,
    stagedDeletes: 0,
    stagedItems: 0,
    stagedProjections: 0,
    stagedRoutes: 0,
    stagedSnapshotBatches: 0,
    stagedSnapshotRows: 0,
    stagedUpserts: 0,
    status: options.status,
    updatedAt: now,
  });
}

/** Inserts the singleton publication pointer with exact slot identities. */
export async function insertTestState(
  ctx: MutationCtx,
  options: TestStateOptions
) {
  const now = Date.UTC(2026, 6, 23, 12);
  await ctx.db.insert("contentState", {
    ...(options.active
      ? {
          activeManifestHash: options.active.manifestHash,
          activeReleaseId: options.active.releaseId,
          activeSequence: options.active.sequence,
        }
      : {}),
    ...(options.candidate
      ? {
          candidateManifestHash: options.candidate.manifestHash,
          candidateReleaseId: options.candidate.releaseId,
          candidateSequence: options.candidate.sequence,
        }
      : {}),
    ...(options.article
      ? {
          articleManifestHash: options.article.manifestHash,
          articleReleaseId: options.article.releaseId,
          articleSequence: options.article.sequence,
        }
      : {}),
    ...(options.material
      ? {
          materialManifestHash: options.material.manifestHash,
          materialReleaseId: options.material.releaseId,
          materialSequence: options.material.sequence,
        }
      : {}),
    key: "primary",
    nextSequence: options.nextSequence,
    ...(options.recovery
      ? {
          recoveryManifestHash: options.recovery.manifestHash,
          recoveryReleaseId: options.recovery.releaseId,
          recoverySequence: options.recovery.sequence,
        }
      : {}),
    ...(options.search
      ? {
          searchManifestHash: options.search.manifestHash,
          searchReleaseId: options.search.releaseId,
          searchSequence: options.search.sequence,
        }
      : {}),
    updatedAt: now,
  });
}

/** Inserts one detached terminal release for cleanup dispatch coverage. */
export async function insertAbortedRelease(ctx: MutationCtx) {
  const now = Date.UTC(2026, 6, 22, 12);
  await ctx.db.insert("contentReleases", {
    abortedAt: now,
    abortedRows: 0,
    abortingAt: now,
    baseFamilies: [],
    checkedIndex: -1,
    checkedItems: 0,
    createdAt: now,
    releaseId: "release-cleanup-dispatch",
    releaseJson: "{}",
    rendererJson: "{}",
    resultFamilies: [],
    role: "candidate",
    sequence: 1,
    stagedArtifacts: 0,
    stagedDeletes: 0,
    stagedItems: 0,
    stagedProjections: 0,
    stagedRoutes: 0,
    stagedSnapshotBatches: 0,
    stagedSnapshotRows: 0,
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
    snapshots: manifest.snapshots,
    stagedArtifacts: 0,
    stagedItems: 0,
    stagedProjections: 0,
    stagedRoutes: 0,
    stagedSnapshotRows: 0,
  };
  await ctx.db.insert("contentReleases", {
    baseFamilies: [],
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
    resultFamilies: [],
    role: "candidate",
    sequence: 1,
    stagedArtifacts: 0,
    stagedDeletes: 0,
    stagedItems: 0,
    stagedProjections: 0,
    stagedRoutes: 0,
    stagedSnapshotBatches: 0,
    stagedSnapshotRows: 0,
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
