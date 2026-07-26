import type { ContentFamily } from "@nakafa/aksara-contracts/content";
import type { ReleaseId } from "@nakafa/aksara-contracts/ids";
import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import type {
  ContentSnapshotSet,
  PublicationScope,
} from "@nakafa/aksara-contracts/release/snapshot";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  TEST_DIGEST,
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
  testPublicationScope,
  testReleaseJson,
  testRendererJson,
} from "@repo/backend/test/content-release";

interface StagedReleaseOptions {
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
    updatedAt: now,
  });
  await ctx.db.insert("contentState", {
    candidateManifestHash: release.manifestHash,
    candidateReleaseId: releaseId,
    candidateSequence: 1,
    key: "primary",
    nextSequence: 2,
    updatedAt: now,
  });
}

/** Inserts one pending release with exact sequence-slot ownership. */
export async function insertTestRelease(
  ctx: MutationCtx,
  options?: StagedReleaseOptions
) {
  const now = Date.UTC(2026, 6, 22, 12);
  const releaseId = options?.releaseId ?? TEST_RELEASE_ID;
  const role = options?.role ?? "candidate";
  const sequence = options?.sequence ?? 1;
  const itemCount = options?.itemCount ?? 1;
  const upsertCount = options?.upsertCount ?? itemCount;
  const scope =
    options?.scope ??
    testPublicationScope({
      snapshots: options?.snapshots,
    });
  await ctx.db.insert("contentReleases", {
    baseFamilies: [...(options?.baseFamilies ?? [])],
    checkedIndex: options?.checkedIndex ?? -1,
    checkedItems: options?.checkedItems ?? 0,
    createdAt: now,
    releaseId,
    releaseJson: testReleaseJson({
      baseManifestHash: options?.originReleaseId ? TEST_DIGEST : null,
      baseReleaseId: options?.originReleaseId ?? null,
      deleteCount: options?.deleteCount ?? itemCount - upsertCount,
      itemCount,
      originReleaseId: options?.originReleaseId,
      projectionCount: options?.projectionCount ?? upsertCount,
      releaseId,
      routeCount: options?.routeCount ?? upsertCount,
      scope,
      snapshots: options?.snapshots,
      upsertCount,
    }),
    rendererJson: testRendererJson(),
    resultFamilies: [
      ...(options?.resultFamilies ??
        (role === "candidate" ? scope.families : [])),
    ],
    role,
    sequence,
    stagedArtifacts: options?.stagedArtifacts ?? 0,
    stagedDeletes: options?.stagedDeletes ?? 0,
    stagedItems: options?.stagedItems ?? 0,
    stagedProjections: options?.stagedProjections ?? 0,
    stagedRoutes: options?.stagedRoutes ?? 0,
    stagedSnapshotBatches: options?.stagedSnapshotBatches ?? 0,
    stagedSnapshotRows: options?.stagedSnapshotRows ?? 0,
    stagedUpserts: options?.stagedUpserts ?? 0,
    status: options?.status ?? "staging",
    updatedAt: now,
  });
  await ctx.db.insert("contentState", {
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
    nextSequence: sequence + 1,
    updatedAt: now,
  });
}
