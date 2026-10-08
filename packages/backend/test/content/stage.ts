import { ContentFamilySchema } from "@nakafa/aksara-contracts/content";
import type { ReleaseId } from "@nakafa/aksara-contracts/ids";
import { ActiveAppLocaleCodeSchema } from "@nakafa/aksara-contracts/locale";
import {
  type SignedContentRelease,
  SignedContentReleaseSchema,
} from "@nakafa/aksara-contracts/release";
import { PublicationScopeSchema } from "@nakafa/aksara-contracts/release/snapshot/scope";
import { ContentSnapshotSetSchema } from "@nakafa/aksara-contracts/release/snapshot/spec";
import { INITIAL_MODEL_SLOT } from "@repo/backend/confect/contentRelease/models/slot";
import { releaseReachability } from "@repo/backend/confect/contentRelease/reachability";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  TEST_DIGEST,
  TEST_MANIFEST_HASH,
  TEST_RELEASE_ID,
  testPublicationScope,
  testReleaseJson,
  testRendererJson,
  testStoredReachability,
} from "@repo/backend/test/content/release";
import { Schema } from "effect";

const SignedReleaseJsonSchema = Schema.fromJsonString(
  SignedContentReleaseSchema
);
const StagedReleaseOptionsSchema = Schema.Struct({
  activeAppLocales: Schema.optionalKey(Schema.Array(ActiveAppLocaleCodeSchema)),
  baseFamilies: Schema.optionalKey(Schema.Array(ContentFamilySchema)),
  checkedIndex: Schema.optionalKey(Schema.Finite),
  checkedItems: Schema.optionalKey(Schema.Finite),
  deleteCount: Schema.optionalKey(Schema.Finite),
  itemCount: Schema.optionalKey(Schema.Finite),
  originKind: Schema.optionalKey(Schema.Literals(["git", "rollback"])),
  originReleaseId: Schema.optionalKey(Schema.String),
  projectionCount: Schema.optionalKey(Schema.Finite),
  releaseId: Schema.optionalKey(Schema.String),
  resultFamilies: Schema.optionalKey(Schema.Array(ContentFamilySchema)),
  role: Schema.optionalKey(Schema.Literals(["candidate", "recovery"])),
  routeCount: Schema.optionalKey(Schema.Finite),
  scope: Schema.optionalKey(PublicationScopeSchema),
  sequence: Schema.optionalKey(Schema.Finite),
  snapshots: Schema.optionalKey(ContentSnapshotSetSchema),
  stagedArtifacts: Schema.optionalKey(Schema.Finite),
  stagedDeletes: Schema.optionalKey(Schema.Finite),
  stagedItems: Schema.optionalKey(Schema.Finite),
  stagedProjections: Schema.optionalKey(Schema.Finite),
  stagedRoutes: Schema.optionalKey(Schema.Finite),
  stagedSnapshotBatches: Schema.optionalKey(Schema.Finite),
  stagedSnapshotRows: Schema.optionalKey(Schema.Finite),
  stagedUpserts: Schema.optionalKey(Schema.Finite),
  status: Schema.optionalKey(
    Schema.Literals(["staging", "verified", "verifying"])
  ),
  upsertCount: Schema.optionalKey(Schema.Finite),
});
type StagedReleaseOptions = typeof StagedReleaseOptionsSchema.Type;

/** Inserts one pending candidate slot with caller-owned frozen envelope bytes. */
export async function insertSignedCandidate(
  ctx: MutationCtx,
  releaseId: ReleaseId,
  release: SignedContentRelease,
  rendererJson: string
) {
  const now = Date.UTC(2026, 6, 22, 12);
  await ctx.db.insert("contentReleases", {
    ...releaseReachability(release),
    baseFamilies: [],
    checkedIndex: -1,
    checkedItems: 0,
    createdAt: now,
    releaseId,
    releaseJson: Schema.encodeSync(SignedReleaseJsonSchema)(release),
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
    originKind,
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
  const releaseJson = testReleaseJson({
    activeAppLocales,
    baseManifestHash: originReleaseId ? TEST_DIGEST : null,
    baseReleaseId: originReleaseId ?? null,
    deleteCount,
    itemCount,
    originKind,
    originReleaseId,
    projectionCount,
    releaseId,
    routeCount,
    scope,
    snapshots,
    upsertCount,
  });
  await ctx.db.insert("contentReleases", {
    ...testStoredReachability(releaseJson),
    baseFamilies: [...baseFamilies],
    checkedIndex,
    checkedItems,
    createdAt: now,
    releaseId,
    releaseJson,
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
