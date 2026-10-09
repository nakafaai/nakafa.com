import { ContentFamilySchema } from "@nakafa/aksara-contracts/content";
import { ContentDeliveryClassSchema } from "@nakafa/aksara-contracts/delivery";
import { APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { ProgramNavigationLevelSchema } from "@nakafa/aksara-contracts/program/spec";
import {
  ContentDeleteSchema,
  ContentUpsertSchema,
} from "@nakafa/aksara-contracts/release";
import {
  ContentRouteBindSchema,
  ContentRouteDeleteSchema,
} from "@nakafa/aksara-contracts/release/route/spec";
import { ContentSnapshotKindSchema } from "@nakafa/aksara-contracts/release/snapshot/scope";
import { ContentSnapshotStateSchema } from "@nakafa/aksara-contracts/release/snapshot/spec";
import { RendererDomainSchema } from "@nakafa/aksara-contracts/renderer/domain";
import { Schema } from "effect";
/** Current Convex data-read ceiling for one query or mutation transaction. */
export const TRANSACTION_READ_LIMIT = 16 * 1024 * 1024;

/** Reserved space for indexes, state, release identity, and response data. */
export const TRANSACTION_READ_HEADROOM = 4 * 1024 * 1024;

/** Eight body-bearing transitions preserve headroom under transaction limits. */
export const RELEASE_PAGE_LIMIT = 8;

/** Maximum history rows considered by one compaction transaction. */
export const COMPACTION_PAGE_COUNT = 32;

/** Maximum history bytes read by one compaction source query. */
export const COMPACTION_PAGE_BYTES = 2 * 1024 * 1024;

/**
 * Maximum content versions inspected by one compaction transaction.
 *
 * Each version reads at most seven heads and may release two artifacts, each
 * proven against one head, one release item, and two try-out placements.
 */
export const COMPACTION_HEAD_COUNT = 8;

/**
 * Maximum release items inspected by one compaction transaction.
 *
 * The page and its deletes each read at most one item past the page byte
 * bound, and each item may release one artifact proven against its references.
 */
export const COMPACTION_ITEM_COUNT = 8;

/**
 * Maximum artifact facts inspected by one cleanup or compaction transaction.
 *
 * Each fact either proves its artifact against its references or deletes one
 * signed body, leaving room for cleanup's release reads.
 */
export const ARTIFACT_PAGE_COUNT = 12;

/** Maximum artifact bytes read before maintenance yields a continuation. */
export const ARTIFACT_PAGE_BYTES = 2 * 1024 * 1024;

/** Maximum records considered before byte and transaction proof guards yield. */
export const PROOF_PAGE_LIMIT = 128;

/** Maximum complete proof-page response below Convex action limits. */
export const PROOF_PAGE_BYTES = 4 * 1024 * 1024;

/** Maximum artifact-proof response including its corresponding item envelopes. */
export const ARTIFACT_PROOF_PAGE_BYTES = 8 * 1024 * 1024;

/** Maximum route identities validated before yielding one proof query. */
export const ROUTE_CATALOG_PAGE_LIMIT = 8;

/** Query capacity reserved before a proof transaction yields its continuation. */
export const PROOF_QUERY_HEADROOM = 16;

/** Minimum retention after an artifact stops being active or recoverable. */
export const ROLLBACK_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** Durable backend-owned publication phases. */
export const releaseStatusValidator = Schema.Literals([
  "staging",
  "verifying",
  "verified",
  "completed",
  "aborting",
  "aborted",
]);

/** Publication role controls which singleton state slot a release may own. */
export const releaseRoleValidator = Schema.Literals(["candidate", "recovery"]);

/** Ordered durable phases for one crash-safe history compaction cycle. */
export const COMPACTION_PHASES = [
  "heads",
  "bindings",
  "items",
  "batches",
  "facts",
  "snapshots",
  "releases",
] as const;
export const compactionPhaseValidator = Schema.Literals([...COMPACTION_PHASES]);

/** Implemented content families owned by the shared release contract. */
export const contentFamilyValidator = Schema.Literals([
  ...ContentFamilySchema.literals,
]);

/** Fixed structured families selected by the global release pointer. */
export const snapshotFamilyValidator = Schema.Literals([
  ...ContentSnapshotKindSchema.literals,
]);

/** Stable delivery policies copied into immutable head versions. */
export const deliveryValidator = Schema.Literals([
  ...ContentDeliveryClassSchema.literals,
]);

/** Application locales owned by public routes and localized read models. */
export const appLocaleValidator = Schema.Literals([...APP_LOCALE_CODES]);

/** Artifact locales owned by immutable compiled-content identities. */
export const artifactLocaleValidator = Schema.Literals([...APP_LOCALE_CODES]);

/** Assessed languages owned by signed question placements. */
export const deliveryLanguageValidator = Schema.Literals([...APP_LOCALE_CODES]);

/** Exact curriculum levels owned by the shared Aksara program contract. */
export const curriculumLevelValidator = Schema.Literals([
  ...ProgramNavigationLevelSchema.literals,
]);

/** Exact physical renderer domains owned by the shared Aksara contract. */
export const rendererDomainValidator = Schema.Literals([
  ...RendererDomainSchema.literals,
]);

/** Immutable content-version operations owned by the release contract. */
export const headOperationValidator = Schema.Literals([
  ContentUpsertSchema.fields.operation.literal,
  ContentDeleteSchema.fields.operation.literal,
]);

/** Immutable route-version operations owned by the route contract. */
export const bindingOperationValidator = Schema.Literals([
  ContentRouteBindSchema.fields.operation.literal,
  ContentRouteDeleteSchema.fields.operation.literal,
]);

/** Resumable progress returned by bounded release-processing mutations. */
export const progressValidator = Schema.Struct({
  done: Schema.Boolean,
  nextIndex: Schema.Finite,
  processed: Schema.Finite,
});

/** Idempotent staging counts returned by bounded batch mutations. */
export const stageReceiptValidator = Schema.Struct({
  batchIndex: Schema.Finite,
  created: Schema.Finite,
  releaseId: Schema.String,
  unchanged: Schema.Finite,
});

/** Snapshot batch outcome bound to its family and immutable identity. */
export const snapshotBatchReceiptValidator = Schema.Struct({
  batchIndex: Schema.Finite,
  created: Schema.Finite,
  family: snapshotFamilyValidator,
  releaseId: Schema.String,
  snapshotId: Schema.String,
  unchanged: Schema.Finite,
});

/** Idempotent outcome for staging one immutable family manifest. */
export const snapshotReceiptValidator = Schema.Struct({
  created: Schema.Literals([0, 1]),
  family: snapshotFamilyValidator,
  releaseId: Schema.String,
  snapshotId: Schema.String,
  unchanged: Schema.Literals([0, 1]),
});

/** Idempotent outcome for one permanent signed try-out runtime bundle. */
export const tryoutRuntimeBundleReceiptValidator = Schema.Struct({
  bundleHash: Schema.String,
  created: Schema.Literals([0, 1]),
  releaseId: Schema.String,
  snapshotId: Schema.String,
  unchanged: Schema.Literals([0, 1]),
});
const snapshotStateValidator = Schema.Struct({
  baseSnapshotId: Schema.Union([Schema.String, Schema.Null]),
  mode: ContentSnapshotStateSchema.fields.mode,
  resultSnapshotId: Schema.Union([Schema.String, Schema.Null]),
  rowCount: Schema.Finite,
  rowDigest: Schema.String,
});

/** Snapshot transition facts history retention reads without the manifest. */
export const releaseSnapshotTransitionValidator = Schema.Struct({
  baseSnapshotId: Schema.Union([Schema.String, Schema.Null]),
  mode: ContentSnapshotStateSchema.fields.mode,
  resultSnapshotId: Schema.Union([Schema.String, Schema.Null]),
});

/** Fixed per-family snapshot transitions stored beside one release. */
export const releaseSnapshotTransitionsValidator = Schema.Struct({
  program: releaseSnapshotTransitionValidator,
  quran: releaseSnapshotTransitionValidator,
  tryout: releaseSnapshotTransitionValidator,
});

/** Completed publication evidence stored and returned without body replay. */
export const publicationReceiptValidator = Schema.Struct({
  activatedHeads: Schema.Finite,
  activeAppLocales: Schema.mutable(Schema.Array(appLocaleValidator)),
  deletedHeads: Schema.Finite,
  manifestHash: Schema.String,
  projectionDigest: Schema.String,
  releaseId: Schema.String,
  resultCount: Schema.Finite,
  resultDigest: Schema.String,
  routeDigest: Schema.String,
  snapshots: Schema.Struct({
    program: snapshotStateValidator,
    quran: snapshotStateValidator,
    tryout: snapshotStateValidator,
  }),
  stagedArtifacts: Schema.Finite,
  stagedItems: Schema.Finite,
  stagedProjections: Schema.Finite,
  stagedRoutes: Schema.Finite,
  stagedSnapshotRows: Schema.Finite,
});

/** Durable release status returned to the resumable publisher. */
export const statusValidator = Schema.Union([
  Schema.Struct({
    manifestHash: Schema.String,
    phase: Schema.Literals([
      "missing",
      "staging",
      "verifying",
      "verified",
      "aborting",
      "aborted",
    ]),
    releaseId: Schema.String,
  }),
  Schema.Struct({
    manifestHash: Schema.String,
    phase: Schema.Literal("completed"),
    receipt: publicationReceiptValidator,
    releaseId: Schema.String,
  }),
]);
const storedBundleValidator = Schema.Struct({
  releaseJson: Schema.String,
  rendererJson: Schema.String,
});
const stagedPhaseValidator = Schema.Literals([
  "staging",
  "verifying",
  "verified",
  "aborting",
]);

/** Authenticated release bundles used for exact crash recovery. */
export const currentValidator = Schema.Struct({
  active: Schema.Union([
    Schema.Null,
    Schema.Struct({
      ...storedBundleValidator.fields,
      ...{
        receipt: publicationReceiptValidator,
      },
    }),
  ]),
  candidate: Schema.Union([
    Schema.Null,
    Schema.Struct({
      ...storedBundleValidator.fields,
      ...{
        phase: stagedPhaseValidator,
      },
    }),
  ]),
  recovery: Schema.Union([
    Schema.Null,
    Schema.Struct({
      ...storedBundleValidator.fields,
      ...{
        phase: stagedPhaseValidator,
      },
    }),
  ]),
  tryoutRuntimeBundleJson: Schema.Union([Schema.String, Schema.Null]),
});

/** Cumulative abort progress with a server-owned continuation cursor. */
export const abortReceiptValidator = Schema.Struct({
  complete: Schema.Boolean,
  processedItems: Schema.Finite,
  releaseId: Schema.String,
  totalItems: Schema.Finite,
});

/** Resumable cleanup evidence matching the public contract. */
export const cleanupReceiptValidator = Schema.Struct({
  complete: Schema.Boolean,
  deletedArtifacts: Schema.Finite,
  releaseId: Schema.String,
  retryAt: Schema.optionalKey(Schema.Finite),
});

/** Bounded compaction progress returned to its scheduled action. */
export const compactionReceiptValidator = Schema.Struct({
  complete: Schema.Boolean,
  deleted: Schema.Finite,
  floor: Schema.Finite,
  phase: compactionPhaseValidator,
});

/** One compact content head shared by publication and proof pages. */
export const contentHeadValidator = Schema.Struct({
  artifactHash: Schema.String,
  artifactLocale: artifactLocaleValidator,
  compilerConfigHash: Schema.String,
  contentKey: Schema.String,
  delivery: deliveryValidator,
  family: contentFamilyValidator,
  projectionHash: Schema.String,
  publicPath: Schema.optionalKey(Schema.String),
  rendererDomain: rendererDomainValidator,
  sourceHash: Schema.String,
  sourcePath: Schema.String,
});

/** Compact active family inventory used for exact source diffing. */
export const headPageValidator = Schema.Struct({
  activeManifestHash: Schema.String,
  activeReleaseId: Schema.String,
  cursor: Schema.Union([Schema.String, Schema.Null]),
  done: Schema.Boolean,
  family: contentFamilyValidator,
  heads: Schema.mutable(Schema.Array(contentHeadValidator)),
  nextCursor: Schema.Union([Schema.String, Schema.Null]),
});
