import { ContentFamilySchema } from "@nakafa/aksara-contracts/content";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import {
  ACTIVE_APP_LOCALE_CODES,
  ActiveAppLocaleCodeSchema,
} from "@nakafa/aksara-contracts/locale";
import { EMPTY_RESULT_CATALOG_DIGEST } from "@nakafa/aksara-contracts/release/result/spec";
import { PublicationScopeSchema } from "@nakafa/aksara-contracts/release/snapshot/scope";
import {
  ContentSnapshotSetSchema,
  inheritContentSnapshots,
  snapshotRowCount,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import {
  INITIAL_MODEL_SLOT,
  modelSlotValidator,
} from "@repo/backend/confect/contentRelease/models/slot";
import { releaseReachability } from "@repo/backend/confect/contentRelease/reachability";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testSignedRelease,
} from "@repo/backend/test/content/proof";
import {
  TEST_DIGEST,
  testReleaseJson,
  testRendererJson,
  testStoredReachability,
} from "@repo/backend/test/content/release";
import { encodeJsonText } from "@repo/utilities/json";
import { Schema } from "effect";

export const TestIdentitySchema = Schema.Struct({
  manifestHash: Schema.String,
  releaseId: Schema.String,
  sequence: Schema.Finite,
});
export type TestIdentity = typeof TestIdentitySchema.Type;

const TestReleaseEnvelopeSchema = Schema.Struct({
  ...TestIdentitySchema.fields,
  activeAppLocales: Schema.optional(Schema.Array(ActiveAppLocaleCodeSchema)),
  base: Schema.optional(TestIdentitySchema),
  originKind: Schema.optional(Schema.Literals(["git", "rollback"])),
  originReleaseId: Schema.optional(Schema.String),
  role: Schema.Literals(["candidate", "recovery"]),
  scope: Schema.optional(PublicationScopeSchema),
  snapshots: Schema.optional(ContentSnapshotSetSchema),
  status: Schema.Literals(["aborted", "completed", "verified"]),
});
type TestReleaseEnvelope = typeof TestReleaseEnvelopeSchema.Type;

const TestReleaseOptionsSchema = Schema.Struct({
  ...TestReleaseEnvelopeSchema.fields,
  ownership: Schema.Struct({
    base: Schema.Array(ContentFamilySchema),
    result: Schema.Array(ContentFamilySchema),
  }),
});
type TestReleaseOptions = typeof TestReleaseOptionsSchema.Type;

const TestStateOptionsSchema = Schema.Struct({
  active: Schema.optional(TestIdentitySchema),
  article: Schema.optional(TestIdentitySchema),
  articleSlot: Schema.optional(modelSlotValidator),
  candidate: Schema.optional(TestIdentitySchema),
  material: Schema.optional(TestIdentitySchema),
  materialSlot: Schema.optional(modelSlotValidator),
  nextSequence: Schema.Finite,
  recovery: Schema.optional(TestIdentitySchema),
  search: Schema.optional(TestIdentitySchema),
  searchSlot: Schema.optional(modelSlotValidator),
});
type TestStateOptions = typeof TestStateOptionsSchema.Type;

/** A JSON object whose fields are kept exactly as stored, so the patch keeps every key. */
const StoredObjectSchema = Schema.Record(Schema.String, Schema.Unknown);
const decodeStoredObject = Schema.decodeUnknownSync(
  Schema.fromJsonString(StoredObjectSchema)
);

/** Creates the exact zero-item signed envelope used by lifecycle tests. */
export function zeroReleaseJson(options: TestReleaseEnvelope) {
  return testReleaseJson({
    activeAppLocales: options.activeAppLocales,
    baseManifestHash: options.base?.manifestHash ?? null,
    baseReleaseId: options.base?.releaseId ?? null,
    baseResultCount: 0,
    baseResultDigest: EMPTY_RESULT_CATALOG_DIGEST,
    itemCount: 0,
    manifestHash: options.manifestHash,
    originKind: options.originKind,
    originReleaseId: options.originReleaseId,
    projectionCount: 0,
    releaseId: options.releaseId,
    resultCount: 0,
    resultDigest: EMPTY_RESULT_CATALOG_DIGEST,
    routeCount: 0,
    scope: options.scope,
    snapshots: options.snapshots,
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
  const snapshots = options.snapshots ?? inheritContentSnapshots(null);
  const terminal = options.status === "completed";
  const aborted = options.status === "aborted";
  const receipt = {
    activatedHeads: 0,
    activeAppLocales: options.activeAppLocales ?? ACTIVE_APP_LOCALE_CODES,
    deletedHeads: 0,
    manifestHash: options.manifestHash,
    projectionDigest: TEST_DIGEST,
    releaseId: options.releaseId,
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
  await ctx.db.insert("contentReleases", {
    ...testStoredReachability(releaseJson),
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
          receiptJson: encodeJsonText(receipt),
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
    stagedSnapshotRows: snapshotRowCount(snapshots),
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
    articleSlot: options.articleSlot ?? INITIAL_MODEL_SLOT,
    ...(options.material
      ? {
          materialManifestHash: options.material.manifestHash,
          materialReleaseId: options.material.releaseId,
          materialSequence: options.material.sequence,
        }
      : {}),
    materialSlot: options.materialSlot ?? INITIAL_MODEL_SLOT,
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
    searchSlot: options.searchSlot ?? INITIAL_MODEL_SLOT,
    updatedAt: now,
  });
}

/** Inserts one detached terminal release for cleanup dispatch coverage. */
export async function insertAbortedRelease(ctx: MutationCtx) {
  const releaseId = "release-cleanup-dispatch";
  const signed = testSignedRelease(
    testEmptyManifest(ReleaseIdSchema.make(releaseId))
  );
  const now = Date.UTC(2026, 6, 22, 12);
  await ctx.db.insert("contentReleases", {
    ...releaseReachability(signed),
    abortedAt: now,
    abortedRows: 0,
    abortingAt: now,
    baseFamilies: [],
    checkedIndex: -1,
    checkedItems: 0,
    createdAt: now,
    releaseId,
    releaseJson: encodeJsonText(signed),
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

/**
 * Rewrites one stored release's signed origin to unrelated provenance.
 *
 * A signed release can no longer carry a rollback origin that names another
 * release, but stored history written before that rule existed can, so this
 * fixture patches the retained bytes instead of minting an invalid release.
 */
export async function patchStoredOriginRelease(
  ctx: MutationCtx,
  releaseId: string,
  originReleaseId: string
) {
  const release = await ctx.db
    .query("contentReleases")
    .withIndex("by_releaseId", (query) => query.eq("releaseId", releaseId))
    .unique();
  if (!release) {
    throw new Error(`Expected stored release ${releaseId}.`);
  }
  const stored = decodeStoredObject(release.releaseJson);
  const manifest = Schema.decodeUnknownSync(StoredObjectSchema)(
    stored.manifest
  );
  await ctx.db.patch("contentReleases", release._id, {
    releaseJson: encodeJsonText({
      ...stored,
      manifest: {
        ...manifest,
        origin: { kind: "rollback", releaseId: originReleaseId },
      },
    }),
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
    activeAppLocales: manifest.activeAppLocales,
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
    ...releaseReachability(active),
    baseFamilies: [],
    checkedIndex: -1,
    checkedItems: 0,
    completedAt: now,
    createdAt: now,
    proofAt: now,
    proofJson: "{}",
    receiptJson: encodeJsonText(receipt),
    releaseId: activeReleaseId,
    releaseJson: encodeJsonText(active),
    rendererJson: encodeJsonText(TEST_PROOF_RENDERER),
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
    articleSlot: INITIAL_MODEL_SLOT,
    key: "primary",
    materialSlot: INITIAL_MODEL_SLOT,
    nextSequence: 2,
    searchSlot: INITIAL_MODEL_SLOT,
    updatedAt: now,
  });
  return active.manifestHash;
}
