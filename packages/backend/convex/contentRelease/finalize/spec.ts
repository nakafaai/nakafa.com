import {
  type Sha256Hash,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  type AppLocaleCode,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import { type Infer, v } from "convex/values";

/** Exact predecessor-bound attempt class selected for terminal expansion. */
export interface FinalizationAttemptSpec {
  readonly appLocale: AppLocaleCode;
  readonly placementDigest: Sha256Hash;
  readonly snapshotId: Sha256Hash;
  readonly snapshotReleaseId: string;
  readonly targetBundleHash: Sha256Hash;
  readonly totalQuestions: number;
}

const DE_LAUNCH_SNAPSHOT_ID = Sha256HashSchema.make(
  "sha256:a190bcb61dddbdafaf3c63507726d6822e18f5ac53e17734c03ed835156c6eaa"
);
const DE_LAUNCH_BUNDLE_HASH = Sha256HashSchema.make(
  "sha256:43ac9e5161782369d3a1987d72c35803766c0d0be0c950fc117ddce29f9533f5"
);
const DE_LAUNCH_RELEASE_ID = "de-launch-20260822-16d6b8e8";

/** Exact content address expected from the protected Aksara signer. */
export const GENESIS_BUNDLE_HASH = Sha256HashSchema.make(
  "sha256:6613c0fe37c6fbc94bc88fa59bacf20d664f6568f8da4dab8347396685573bd1"
);

/** Existing authenticated runtime whose renderer bytes match genesis. */
export const GENESIS_RENDERER_SOURCE_HASH = Sha256HashSchema.make(
  "sha256:58f26a6cfcf0b4632453fb5d8e66725cc8f7797e04ee0eb393044421b3b4a1bf"
);

/** Exact immutable source facts recovered from the genesis release. */
export interface FinalizationGenesisIdentity {
  readonly rendererManifestHash: Sha256Hash;
  readonly snapshotId: Sha256Hash;
  readonly sourceGitSha: string;
  readonly sourceManifestHash: Sha256Hash;
  readonly sourceReleaseId: string;
}

export const genesisIdentity = {
  rendererManifestHash: Sha256HashSchema.make(
    "sha256:e06c5326020aeb0c43c0c565948b18a111a4df009ff3b3fe5cd827f35f9275e7"
  ),
  snapshotId: Sha256HashSchema.make(
    "sha256:8947def031cc7046d2d488dac2d9058d13de8bb3aad2f76584f96fe5bd5fc813"
  ),
  sourceGitSha: "e3a7f1e05bc64e1439e54084f50f2ad6ce22cd79",
  sourceManifestHash: Sha256HashSchema.make(
    "sha256:bee5d6e2bd95d8088596766f9e5c138c2e2558d0db7bbc16b97e93868c388ede"
  ),
  sourceReleaseId: "genesis-six-scope-v013-20260814-e3a7f1e",
} as const;

/** Content address of the exact four opaque attempt identities. */
export const FINALIZATION_ATTEMPT_SET_HASH = Sha256HashSchema.make(
  "sha256:b0c43daa74073c7650a73498cd5d9c7dfa4d9fee50fb76b0eaaae246e75386fe"
);

/** Maximum complete attempt inventory accepted by the one-way transaction. */
export const FINALIZATION_ATTEMPT_LIMIT = 1000;

/** Domain separator for the opaque attempt identity set. */
export const FINALIZATION_ATTEMPT_SET_DOMAIN =
  "nakafa.tryout-terminal-backfill.attempt-set.v1";

/** Domain separator for one complete immutable placement set. */
export const FINALIZATION_PLACEMENT_SET_DOMAIN =
  "nakafa.tryout-terminal-backfill.placement-set.v1";

/** Exact four immutable attempt classes recovered from production. */
export const finalizationAttemptSpecs: readonly FinalizationAttemptSpec[] = [
  {
    appLocale: AppLocaleSchema.make("id"),
    placementDigest: Sha256HashSchema.make(
      "sha256:11816938cbe7a3d3e30f9bd20bdc27ec5c7107a5b82217eed81ceab96245ecf4"
    ),
    snapshotId: DE_LAUNCH_SNAPSHOT_ID,
    snapshotReleaseId: DE_LAUNCH_RELEASE_ID,
    targetBundleHash: DE_LAUNCH_BUNDLE_HASH,
    totalQuestions: 40,
  },
  {
    appLocale: AppLocaleSchema.make("de"),
    placementDigest: Sha256HashSchema.make(
      "sha256:5a54145a4da51a09f02e2314ce492642331cc6afd8bf2e6ff4d172b949f45bbe"
    ),
    snapshotId: DE_LAUNCH_SNAPSHOT_ID,
    snapshotReleaseId: DE_LAUNCH_RELEASE_ID,
    targetBundleHash: DE_LAUNCH_BUNDLE_HASH,
    totalQuestions: 150,
  },
  {
    appLocale: AppLocaleSchema.make("en"),
    placementDigest: Sha256HashSchema.make(
      "sha256:39ec8ae15bc345e66d74bcc0d42af6a1badb40ed9287cf4e1296b69d5a46e05e"
    ),
    snapshotId: DE_LAUNCH_SNAPSHOT_ID,
    snapshotReleaseId: DE_LAUNCH_RELEASE_ID,
    targetBundleHash: DE_LAUNCH_BUNDLE_HASH,
    totalQuestions: 40,
  },
  {
    appLocale: AppLocaleSchema.make("id"),
    placementDigest: Sha256HashSchema.make(
      "sha256:1a39f86878a7d7d7d8759a448e99d0a1c476bd5641e1c9f23ab26d5cbee9f84d"
    ),
    snapshotId: genesisIdentity.snapshotId,
    snapshotReleaseId: genesisIdentity.sourceReleaseId,
    targetBundleHash: GENESIS_BUNDLE_HASH,
    totalQuestions: 40,
  },
];

/** Complete immutable contract for the one terminal expansion transaction. */
export const finalizationContract = {
  attemptLimit: FINALIZATION_ATTEMPT_LIMIT,
  attemptSetHash: FINALIZATION_ATTEMPT_SET_HASH,
  attempts: finalizationAttemptSpecs,
  genesisBundleHash: GENESIS_BUNDLE_HASH,
  genesisIdentity,
} as const;
export interface FinalizationContract {
  readonly attemptLimit: number;
  readonly attemptSetHash: Sha256Hash;
  readonly attempts: readonly FinalizationAttemptSpec[];
  readonly genesisBundleHash: Sha256Hash;
  readonly genesisIdentity: FinalizationGenesisIdentity;
}

/** Complete stored facts authenticated before permanent ownership changes. */
export const finalizationTargetSourceValidator = v.object({
  _creationTime: v.number(),
  _id: v.id("tryoutRuntimeBundles"),
  bundleHash: v.string(),
  bundleJson: v.string(),
  cleanupReleaseId: v.optional(v.string()),
  createdAt: v.number(),
  rendererJson: v.string(),
  rendererManifestHash: v.string(),
  snapshotId: v.string(),
  sourceGitSha: v.string(),
  sourceManifestHash: v.string(),
  sourceReleaseId: v.string(),
});
export type FinalizationTargetSource = Infer<
  typeof finalizationTargetSourceValidator
>;

/** Exact renderer and permanent targets loaded by the Node action. */
export const finalizationSourceValidator = v.object({
  rendererJson: v.string(),
  rendererManifestHash: v.string(),
  targets: v.array(finalizationTargetSourceValidator),
});
export type FinalizationSource = Infer<typeof finalizationSourceValidator>;

/** Public input for the Node-authenticated finalization operation. */
export const finalizationDispatchArgsValidator = v.object({
  bundleJson: v.string(),
});

/** Internal transaction input bound to authenticated permanent targets. */
export const finalizationBackfillArgsValidator = v.object({
  bundleJson: v.string(),
  rendererJson: v.string(),
  targetProofHash: v.string(),
});
export type FinalizationBackfillArgs = Infer<
  typeof finalizationBackfillArgsValidator
>;

/** Single runtime and type contract for the terminal expansion receipt. */
export const finalizationReceiptValidator = v.object({
  backfilledAttempts: v.number(),
  bundleCreated: v.union(v.literal(0), v.literal(1)),
  permanentAttempts: v.number(),
  placementCount: v.number(),
});
export type FinalizationReceipt = Infer<typeof finalizationReceiptValidator>;
