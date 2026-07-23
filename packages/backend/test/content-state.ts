import { EMPTY_RESULT_CATALOG_DIGEST } from "@nakafa/aksara-contracts/release/result";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
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

interface TestReleaseOptions extends TestIdentity {
  readonly base?: TestIdentity;
  readonly originReleaseId?: string;
  readonly role: "candidate" | "recovery";
  readonly status: "aborted" | "completed" | "verified";
}

interface TestStateOptions {
  readonly active?: TestIdentity;
  readonly candidate?: TestIdentity;
  readonly nextSequence: number;
  readonly recovery?: TestIdentity;
}

/** Creates the exact zero-item signed envelope used by lifecycle tests. */
export function zeroReleaseJson(options: TestReleaseOptions) {
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
    stagedArtifacts: 0,
    stagedItems: 0,
    stagedProjections: 0,
    stagedRoutes: 0,
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
    checkedIndex: -1,
    checkedItems: 0,
    createdAt: now,
    releaseId: options.releaseId,
    releaseJson,
    rendererJson: testRendererJson(),
    role: options.role,
    sequence: options.sequence,
    stagedArtifacts: 0,
    stagedDeletes: 0,
    stagedItems: 0,
    stagedProjections: 0,
    stagedRoutes: 0,
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
    key: "primary",
    nextSequence: options.nextSequence,
    ...(options.recovery
      ? {
          recoveryManifestHash: options.recovery.manifestHash,
          recoveryReleaseId: options.recovery.releaseId,
          recoverySequence: options.recovery.sequence,
        }
      : {}),
    updatedAt: now,
  });
}
