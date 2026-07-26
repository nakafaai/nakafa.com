import {
  ContentFamilySchema,
  ContentLocaleSchema,
} from "@nakafa/aksara-contracts/content";
import { ContentDeliveryClassSchema } from "@nakafa/aksara-contracts/delivery";
import { ProgramNavigationLevelSchema } from "@nakafa/aksara-contracts/program/spec";
import {
  ContentDeleteSchema,
  ContentUpsertSchema,
} from "@nakafa/aksara-contracts/release";
import {
  ContentRouteBindSchema,
  ContentRouteDeleteSchema,
} from "@nakafa/aksara-contracts/release/route";
import { ContentSnapshotKindSchema } from "@nakafa/aksara-contracts/release/snapshot";
import { RendererDomainSchema } from "@nakafa/aksara-contracts/renderer/domain";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

/** Current Convex data-read ceiling for one query or mutation transaction. */
export const TRANSACTION_READ_LIMIT = 16 * 1024 * 1024;

/** Reserved space for indexes, state, release identity, and response data. */
export const TRANSACTION_READ_HEADROOM = 4 * 1024 * 1024;

/** Eight body-bearing transitions preserve headroom under transaction limits. */
export const RELEASE_PAGE_LIMIT = 8;

/** Maximum exact identities owned atomically by one narrow release scope. */
export const EXACT_SCOPE_LIMIT = 64;

/** Maximum history rows considered by one compaction transaction. */
export const COMPACTION_PAGE_COUNT = 32;

/** Maximum history bytes read by one compaction source query. */
export const COMPACTION_PAGE_BYTES = 2 * 1024 * 1024;

/** Maximum content versions inspected when each may release two artifacts. */
export const COMPACTION_HEAD_COUNT = 2;

/** Maximum release items inspected when each may release one artifact. */
export const COMPACTION_ITEM_COUNT = 4;

/** Maximum artifact rows inspected by one cleanup transaction. */
export const ARTIFACT_PAGE_COUNT = 4;

/** Maximum artifact bytes read before maintenance yields a continuation. */
export const ARTIFACT_PAGE_BYTES = 2 * 1024 * 1024;

/** Maximum body-bearing records returned by one proof query. */
export const PROOF_PAGE_LIMIT = 8;

/** Maximum complete proof-page response below Convex action limits. */
export const PROOF_PAGE_BYTES = 4 * 1024 * 1024;

/** Minimum retention after an artifact stops being active or recoverable. */
export const ROLLBACK_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** Durable backend-owned publication phases. */
export const releaseStatusValidator = literals(
  "staging",
  "verifying",
  "verified",
  "completed",
  "aborting",
  "aborted"
);

/** Publication role controls which singleton state slot a release may own. */
export const releaseRoleValidator = literals("candidate", "recovery");

/** Ordered durable phases for one crash-safe history compaction cycle. */
export const compactionPhaseValidator = literals(
  "heads",
  "owners",
  "bindings",
  "items",
  "batches",
  "artifacts",
  "snapshots",
  "releases"
);

/** Implemented content families owned by the shared release contract. */
export const contentFamilyValidator = literals(...ContentFamilySchema.literals);

/** Fixed structured families selected by the global release pointer. */
export const snapshotFamilyValidator = literals(
  ...ContentSnapshotKindSchema.literals
);

/** Stable delivery policies copied into immutable head versions. */
export const deliveryValidator = literals(
  ...ContentDeliveryClassSchema.literals
);

/** Exact locale values owned by the shared Aksara contract. */
export const localeValidator = literals(...ContentLocaleSchema.literals);

/** Exact curriculum levels owned by the shared Aksara program contract. */
export const curriculumLevelValidator = literals(
  ...ProgramNavigationLevelSchema.literals
);

/** Exact physical renderer domains owned by the shared Aksara contract. */
export const rendererDomainValidator = literals(
  ...RendererDomainSchema.literals
);

/** Immutable content-version operations owned by the release contract. */
export const headOperationValidator = literals(
  ...ContentUpsertSchema.fields.operation.literals,
  ...ContentDeleteSchema.fields.operation.literals
);

/** Immutable route-version operations owned by the route contract. */
export const bindingOperationValidator = literals(
  ...ContentRouteBindSchema.fields.operation.literals,
  ...ContentRouteDeleteSchema.fields.operation.literals
);

/** Resumable progress returned by bounded release-processing mutations. */
export const progressValidator = v.object({
  done: v.boolean(),
  nextIndex: v.number(),
  processed: v.number(),
});

/** Idempotent staging counts returned by bounded batch mutations. */
export const stageReceiptValidator = v.object({
  batchIndex: v.number(),
  created: v.number(),
  releaseId: v.string(),
  unchanged: v.number(),
});

/** Snapshot batch outcome bound to its family and immutable identity. */
export const snapshotBatchReceiptValidator = v.object({
  batchIndex: v.number(),
  created: v.number(),
  family: snapshotFamilyValidator,
  releaseId: v.string(),
  snapshotId: v.string(),
  unchanged: v.number(),
});

/** Idempotent outcome for staging one immutable family manifest. */
export const snapshotReceiptValidator = v.object({
  created: literals(0, 1),
  family: snapshotFamilyValidator,
  releaseId: v.string(),
  snapshotId: v.string(),
  unchanged: literals(0, 1),
});

const snapshotStateValidator = v.object({
  baseSnapshotId: v.union(v.string(), v.null()),
  mode: literals("inherit", "replace", "restore"),
  resultSnapshotId: v.union(v.string(), v.null()),
  rowCount: v.number(),
  rowDigest: v.string(),
});

/** Completed publication evidence stored and returned without body replay. */
export const publicationReceiptValidator = v.object({
  activatedHeads: v.number(),
  deletedHeads: v.number(),
  manifestHash: v.string(),
  projectionDigest: v.string(),
  releaseId: v.string(),
  resultCount: v.number(),
  resultDigest: v.string(),
  routeDigest: v.string(),
  snapshots: v.object({
    program: snapshotStateValidator,
    quran: snapshotStateValidator,
    tryout: snapshotStateValidator,
  }),
  stagedArtifacts: v.number(),
  stagedItems: v.number(),
  stagedProjections: v.number(),
  stagedRoutes: v.number(),
  stagedSnapshotRows: v.number(),
});

/** Durable release status returned to the resumable publisher. */
export const statusValidator = v.union(
  v.object({
    manifestHash: v.string(),
    phase: literals(
      "missing",
      "staging",
      "verifying",
      "verified",
      "aborting",
      "aborted"
    ),
    releaseId: v.string(),
  }),
  v.object({
    manifestHash: v.string(),
    phase: v.literal("completed"),
    receipt: publicationReceiptValidator,
    releaseId: v.string(),
  })
);

const storedBundleValidator = v.object({
  releaseJson: v.string(),
  rendererJson: v.string(),
});

const stagedPhaseValidator = literals(
  "staging",
  "verifying",
  "verified",
  "aborting"
);

/** Authenticated release bundles used for exact crash recovery. */
export const currentValidator = v.object({
  active: v.union(
    v.null(),
    storedBundleValidator.extend({ receipt: publicationReceiptValidator })
  ),
  candidate: v.union(
    v.null(),
    storedBundleValidator.extend({ phase: stagedPhaseValidator })
  ),
  recovery: v.union(
    v.null(),
    storedBundleValidator.extend({ phase: stagedPhaseValidator })
  ),
});

/** Cumulative abort progress with a server-owned continuation cursor. */
export const abortReceiptValidator = v.object({
  complete: v.boolean(),
  processedItems: v.number(),
  releaseId: v.string(),
  totalItems: v.number(),
});

/** Resumable cleanup evidence matching the public contract. */
export const cleanupReceiptValidator = v.object({
  complete: v.boolean(),
  deletedArtifacts: v.number(),
  releaseId: v.string(),
  retryAt: v.optional(v.number()),
});

/** Bounded compaction progress returned to its scheduled action. */
export const compactionReceiptValidator = v.object({
  complete: v.boolean(),
  deleted: v.number(),
  floor: v.number(),
  phase: compactionPhaseValidator,
});

/** One compact content head shared by publication and proof pages. */
export const contentHeadValidator = v.object({
  artifactHash: v.string(),
  compilerConfigHash: v.string(),
  contentKey: v.string(),
  delivery: deliveryValidator,
  family: contentFamilyValidator,
  locale: localeValidator,
  projectionHash: v.string(),
  publicPath: v.optional(v.string()),
  rendererDomain: rendererDomainValidator,
  sourceHash: v.string(),
  sourcePath: v.string(),
});

/** Compact active family inventory used for exact source diffing. */
export const headPageValidator = v.object({
  activeManifestHash: v.string(),
  activeReleaseId: v.string(),
  cursor: v.union(v.string(), v.null()),
  done: v.boolean(),
  family: contentFamilyValidator,
  heads: v.array(contentHeadValidator),
  nextCursor: v.union(v.string(), v.null()),
});
