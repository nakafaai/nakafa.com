import { ContentFamilySchema } from "@nakafa/aksara-contracts/content";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { EMPTY_RESULT_CATALOG_DIGEST } from "@nakafa/aksara-contracts/release/result/spec";
import type { ContentSnapshotSet } from "@nakafa/aksara-contracts/release/snapshot/spec";
import {
  inheritContentSnapshots,
  invertContentSnapshots,
  snapshotRowCount,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import { CURRENT_CONTENT_GENERATION } from "@repo/backend/confect/contentRelease/generation";
import { TEST_DIGEST } from "@repo/backend/test/content/release";
import {
  insertTestState,
  insertZeroRelease,
  type TestIdentity,
} from "@repo/backend/test/content/state";

export const CANDIDATE = {
  manifestHash: `sha256:${"6".repeat(64)}`,
  releaseId: "release-candidate",
  sequence: 1,
} satisfies TestIdentity;

export const BASE = {
  manifestHash: `sha256:${"5".repeat(64)}`,
  releaseId: "release-base",
  sequence: 0,
} satisfies TestIdentity;

export const RECOVERY = {
  manifestHash: `sha256:${"7".repeat(64)}`,
  releaseId: "release-recovery",
  sequence: 2,
} satisfies TestIdentity;

/** The active release that a full replacement extends. */
const REPLACED_BASE = {
  manifestHash: `sha256:${"b".repeat(64)}`,
  releaseId: "release-replaced-base",
  sequence: 1,
} satisfies TestIdentity;

/** A verified candidate that replaces every family of its base. */
export const REPLACEMENT = {
  manifestHash: `sha256:${"c".repeat(64)}`,
  releaseId: "release-replacement",
  sequence: 2,
} satisfies TestIdentity;

/** The retained inverse of the replacement. */
export const REPLACEMENT_RECOVERY = {
  manifestHash: `sha256:${"d".repeat(64)}`,
  releaseId: "release-replacement-recovery",
  sequence: 3,
} satisfies TestIdentity;

/**
 * Seeds one verified candidate that replaces its base, with its generation,
 * snapshots and optional inverse chosen by the test. A null generation leaves
 * the active release's generation unrecorded.
 */
export async function seedReplacementCandidate(
  ctx: Parameters<typeof insertTestState>[0],
  options: {
    readonly generation?: typeof CURRENT_CONTENT_GENERATION | null;
    readonly recovery?: boolean;
    readonly snapshots?: ContentSnapshotSet;
  }
) {
  await insertZeroRelease(ctx, {
    ...REPLACED_BASE,
    ownership: { base: [], result: ContentFamilySchema.literals },
    role: "candidate",
    status: "completed",
  });
  await insertZeroRelease(ctx, {
    ...REPLACEMENT,
    base: REPLACED_BASE,
    ownership: {
      base: ContentFamilySchema.literals,
      result: ContentFamilySchema.literals,
    },
    role: "candidate",
    snapshots: options.snapshots,
    status: "verified",
  });
  if (options.recovery) {
    await insertZeroRelease(ctx, {
      ...REPLACEMENT_RECOVERY,
      base: REPLACEMENT,
      originReleaseId: REPLACEMENT.releaseId,
      ownership: { base: ContentFamilySchema.literals, result: [] },
      role: "recovery",
      snapshots: options.snapshots && invertContentSnapshots(options.snapshots),
      status: "verified",
    });
  }
  await insertTestState(ctx, {
    active: REPLACED_BASE,
    candidate: REPLACEMENT,
    generation:
      options.generation === undefined
        ? CURRENT_CONTENT_GENERATION
        : options.generation,
    nextSequence: 4,
    recovery: options.recovery ? REPLACEMENT_RECOVERY : undefined,
  });
}

/** Seeds one verified genesis candidate and its exact verified inverse. */
export async function seedVerifiedPair(
  ctx: Parameters<typeof insertTestState>[0],
  snapshots?: {
    readonly base?: TestIdentity;
    readonly candidate: ContentSnapshotSet;
    readonly recovery: ContentSnapshotSet;
  }
) {
  await insertZeroRelease(ctx, {
    ...CANDIDATE,
    base: snapshots?.base,
    ownership: {
      base: snapshots?.base ? ContentFamilySchema.literals : [],
      result: ContentFamilySchema.literals,
    },
    role: "candidate",
    snapshots: snapshots?.candidate,
    status: "verified",
  });
  await insertZeroRelease(ctx, {
    ...RECOVERY,
    base: CANDIDATE,
    originReleaseId: CANDIDATE.releaseId,
    ownership: {
      base: ContentFamilySchema.literals,
      result: [],
    },
    role: "recovery",
    snapshots: snapshots?.recovery,
    status: "verified",
  });
  await insertTestState(ctx, {
    active: snapshots?.base,
    candidate: CANDIDATE,
    nextSequence: 3,
    recovery: RECOVERY,
  });
}

/** Builds the exact terminal receipt expected for one technical identity. */
export function expectedReceipt(
  identity: TestIdentity,
  snapshots = inheritContentSnapshots(null)
) {
  return {
    activatedHeads: 0,
    activeAppLocales: [...ACTIVE_APP_LOCALE_CODES],
    deletedHeads: 0,
    manifestHash: identity.manifestHash,
    projectionDigest: TEST_DIGEST,
    releaseId: identity.releaseId,
    resultCount: 0,
    resultDigest: EMPTY_RESULT_CATALOG_DIGEST,
    routeDigest: TEST_DIGEST,
    snapshots,
    stagedArtifacts: 0,
    stagedItems: 0,
    stagedProjections: 0,
    stagedRoutes: 0,
    stagedSnapshotRows: snapshotRowCount(snapshots),
  };
}
