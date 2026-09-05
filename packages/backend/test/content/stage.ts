import type { ContentFamily } from "@nakafa/aksara-contracts/content";
import type { ReleaseId } from "@nakafa/aksara-contracts/ids";
import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import type { PublicationScope } from "@nakafa/aksara-contracts/release/snapshot/scope";
import type { ContentSnapshotSet } from "@nakafa/aksara-contracts/release/snapshot/spec";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { INITIAL_MODEL_SLOT } from "@repo/backend/convex/contentRelease/models/slot";
import {
  TEST_DIGEST,
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
  testPublicationScope,
  testReleaseJson,
  testRendererJson,
} from "@repo/backend/test/content/release";

interface StagedReleaseOptions {
  readonly activeAppLocales?: readonly ActiveAppLocaleCode[];
  readonly baseFamilies?: readonly ContentFamily[];
  readonly checkedIndex?: number;
  readonly checkedItems?: number;
  readonly deleteCount?: number;
  readonly itemCount?: number;
  readonly originReleaseId?: string;
  readonly projectionCount?: number;
  readonly releaseId?: string;
  readonly resultFamilies?: readonly ContentFamily[];
  readonly role?: "candidate" | "recovery";
  readonly routeCount?: number;
  readonly scope?: PublicationScope;
  readonly sequence?: number;
  readonly snapshots?: ContentSnapshotSet;
  readonly stagedArtifacts?: number;
  readonly stagedDeletes?: number;
  readonly stagedItems?: number;
  readonly stagedProjections?: number;
  readonly stagedRoutes?: number;
  readonly stagedSnapshotBatches?: number;
  readonly stagedSnapshotRows?: number;
  readonly stagedUpserts?: number;
  readonly status?: "staging" | "verified" | "verifying";
  readonly upsertCount?: number;
}

/** Inserts one pending candidate slot with caller-owned frozen envelope bytes. */
export async function insertSignedCandidate(
  ctx: MutationCtx,
  releaseId: ReleaseId,
  release: SignedContentRelease,
  rendererJson: string
) {
  const now = Date.UTC(2026, 6, 22, 12);
  await ctx.db.insert("contentReleases", {
    baseFamilies: [],
    checkedIndex: -1,
    checkedItems: 0,
    createdAt: now,
    releaseId,
    releaseJson: JSON.stringify(release),
    rendererJson,
    resultFamilies: [...release.manifest.scope.families],
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
    status: "staging",
    tryoutRuntimeRequired: true,
    updatedAt: now,
  });
  await ctx.db.insert("contentState", {
    articleSlot: INITIAL_MODEL_SLOT,
    candidateManifestHash: release.manifestHash,
    candidateReleaseId: releaseId,
    candidateSequence: 1,
    key: "primary",
    materialSlot: INITIAL_MODEL_SLOT,
    nextSequence: 2,
    searchSlot: INITIAL_MODEL_SLOT,
    updatedAt: now,
  });
}

/** Inserts one pending release with exact sequence-slot ownership. */
export async function insertTestRelease(
  ctx: MutationCtx,
  {
    activeAppLocales,
    baseFamilies = [],
    checkedIndex = -1,
    checkedItems = 0,
    itemCount = 1,
    upsertCount = itemCount,
    deleteCount = itemCount - upsertCount,
    originReleaseId,
    projectionCount = upsertCount,
    releaseId = TEST_RELEASE_ID,
    role = "candidate",
    routeCount = upsertCount,
    sequence = 1,
    snapshots,
    scope = testPublicationScope({ snapshots }),
    resultFamilies = role === "candidate" ? scope.families : [],
    stagedArtifacts = 0,
    stagedDeletes = 0,
    stagedItems = 0,
    stagedProjections = 0,
    stagedRoutes = 0,
    stagedSnapshotBatches = 0,
    stagedSnapshotRows = 0,
    stagedUpserts = 0,
    status = "staging",
  }: StagedReleaseOptions = {}
) {
  const now = Date.UTC(2026, 6, 22, 12);
  await ctx.db.insert("contentReleases", {
    baseFamilies: [...baseFamilies],
    checkedIndex,
    checkedItems,
    createdAt: now,
    releaseId,
    releaseJson: testReleaseJson({
      activeAppLocales,
      baseManifestHash: originReleaseId ? TEST_DIGEST : null,
      baseReleaseId: originReleaseId ?? null,
      deleteCount,
      itemCount,
      originReleaseId,
      projectionCount,
      releaseId,
      routeCount,
      scope,
      snapshots,
      upsertCount,
    }),
    rendererJson: testRendererJson(),
    resultFamilies: [...resultFamilies],
    role,
    sequence,
    stagedArtifacts,
    stagedDeletes,
    stagedItems,
    stagedProjections,
    stagedRoutes,
    stagedSnapshotBatches,
    stagedSnapshotRows,
    stagedUpserts,
    status,
    updatedAt: now,
  });
  await ctx.db.insert("contentState", {
    articleSlot: INITIAL_MODEL_SLOT,
    ...(role === "candidate"
      ? {
          candidateManifestHash: TEST_MANIFEST_HASH,
          candidateReleaseId: releaseId,
          candidateSequence: sequence,
        }
      : {
          recoveryManifestHash: TEST_MANIFEST_HASH,
          recoveryReleaseId: releaseId,
          recoverySequence: sequence,
        }),
    key: "primary",
    materialSlot: INITIAL_MODEL_SLOT,
    nextSequence: sequence + 1,
    searchSlot: INITIAL_MODEL_SLOT,
    updatedAt: now,
  });
}
