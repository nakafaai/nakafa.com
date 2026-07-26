import snapshotSchema from "@repo/backend/convex/contentRelease/snapshot/schema";
import {
  bindingOperationValidator,
  compactionPhaseValidator,
  contentFamilyValidator,
  deliveryValidator,
  headOperationValidator,
  localeValidator,
  releaseRoleValidator,
  releaseStatusValidator,
  rendererDomainValidator,
} from "@repo/backend/convex/contentRelease/spec";
import { defineTable } from "convex/server";
import { v } from "convex/values";

const releaseProgress = {
  checkedIndex: v.number(),
  checkedItems: v.number(),
  stagedArtifacts: v.number(),
  stagedDeletes: v.number(),
  stagedItems: v.number(),
  stagedProjections: v.number(),
  stagedRoutes: v.number(),
  stagedSnapshotBatches: v.number(),
  stagedSnapshotRows: v.number(),
  stagedUpserts: v.number(),
};

const tables = {
  /** Immutable signed artifacts addressed by their authenticated hash. */
  contentArtifacts: defineTable({
    artifactHash: v.string(),
    artifactJson: v.string(),
    createdAt: v.number(),
    retainUntil: v.number(),
  })
    .index("by_artifactHash", ["artifactHash"])
    .index("by_retainUntil_and_artifactHash", ["retainUntil", "artifactHash"]),

  /** Permanent canonical identities used for bounded catalog pagination. */
  contentKeys: defineTable({
    contentKey: v.string(),
    createdSequence: v.number(),
    family: contentFamilyValidator,
    locale: localeValidator,
  })
    .index("by_contentKey_and_locale", ["contentKey", "locale"])
    .index("by_createdSequence_and_contentKey_and_locale", [
      "createdSequence",
      "contentKey",
      "locale",
    ])
    .index("by_family_and_contentKey_and_locale", [
      "family",
      "contentKey",
      "locale",
    ])
    .index("by_family_and_locale_and_createdSequence_and_contentKey", [
      "family",
      "locale",
      "createdSequence",
      "contentKey",
    ]),

  /** Permanent public-route identities used for bounded MVCC validation. */
  contentPaths: defineTable({
    createdSequence: v.number(),
    locale: localeValidator,
    publicPath: v.string(),
  })
    .index("by_locale_and_publicPath", ["locale", "publicPath"])
    .index("by_createdSequence_and_locale_and_publicPath", [
      "createdSequence",
      "locale",
      "publicPath",
    ]),

  /** Immutable content versions selected by the active release sequence. */
  contentHeads: defineTable({
    artifactHash: v.optional(v.string()),
    compilerConfigHash: v.optional(v.string()),
    contentKey: v.string(),
    delivery: v.optional(deliveryValidator),
    family: contentFamilyValidator,
    index: v.number(),
    locale: localeValidator,
    operation: headOperationValidator,
    projectionHash: v.optional(v.string()),
    projectionJson: v.optional(v.string()),
    releaseId: v.string(),
    rendererDomain: v.optional(rendererDomainValidator),
    sequence: v.number(),
    sourceHash: v.optional(v.string()),
    sourcePath: v.optional(v.string()),
  })
    .index("by_contentKey_and_locale_and_sequence", [
      "contentKey",
      "locale",
      "sequence",
    ])
    .index("by_releaseId_and_index", ["releaseId", "index"])
    .index("by_releaseId_and_contentKey_and_locale", [
      "releaseId",
      "contentKey",
      "locale",
    ])
    .index("by_artifactHash_and_sequence", ["artifactHash", "sequence"])
    .index("by_sequence", ["sequence"]),

  /** One active public search row per locale-specific content identity. */
  contentIndex: defineTable({
    contentKey: v.string(),
    family: contentFamilyValidator,
    locale: localeValidator,
    projectionHash: v.string(),
    publicPath: v.string(),
    releaseId: v.string(),
    sequence: v.number(),
    text: v.string(),
  })
    .index("by_contentKey_and_locale", ["contentKey", "locale"])
    .searchIndex("search_text", {
      searchField: "text",
      filterFields: ["family", "locale"],
    }),

  /** Active public articles ordered independently from the search index. */
  articleCatalog: defineTable({
    bucket: v.string(),
    category: v.string(),
    categoryTitle: v.string(),
    contentKey: v.string(),
    date: v.string(),
    locale: localeValidator,
    projectionHash: v.string(),
    publicPath: v.string(),
    releaseId: v.string(),
    rendererDomain: rendererDomainValidator,
    sequence: v.number(),
  })
    .index("by_contentKey_and_locale", ["contentKey", "locale"])
    .index("by_locale_and_date_and_contentKey", [
      "locale",
      "date",
      "contentKey",
    ])
    .index("by_locale_and_category_and_date_and_contentKey", [
      "locale",
      "category",
      "date",
      "contentKey",
    ])
    .index("by_locale_and_bucket_and_publicPath", [
      "locale",
      "bucket",
      "publicPath",
    ]),

  /** One active localized title and representative per article category. */
  articleCategories: defineTable({
    bucket: v.string(),
    category: v.string(),
    contentKey: v.string(),
    locale: localeValidator,
    projectionHash: v.string(),
    releaseId: v.string(),
    rendererDomain: rendererDomainValidator,
    sequence: v.number(),
    title: v.string(),
  })
    .index("by_locale_and_category", ["locale", "category"])
    .index("by_locale_and_bucket_and_category", [
      "locale",
      "bucket",
      "category",
    ]),

  /** Non-empty deterministic partitions for bounded article sitemaps. */
  articleBuckets: defineTable({
    articleCount: v.number(),
    bucket: v.string(),
    categoryCount: v.number(),
    locale: localeValidator,
  }).index("by_locale_and_bucket", ["locale", "bucket"]),

  /** Immutable route versions resolved before access policy enforcement. */
  contentBindings: defineTable({
    batchHash: v.string(),
    batchIndex: v.number(),
    contentKey: v.optional(v.string()),
    index: v.number(),
    locale: localeValidator,
    operation: bindingOperationValidator,
    publicPath: v.string(),
    releaseId: v.string(),
    routeJson: v.string(),
    sequence: v.number(),
  })
    .index("by_locale_and_publicPath_and_sequence_and_index", [
      "locale",
      "publicPath",
      "sequence",
      "index",
    ])
    .index("by_releaseId_and_index", ["releaseId", "index"])
    .index("by_releaseId_and_batchIndex", ["releaseId", "batchIndex"])
    .index("by_releaseId_and_locale_and_publicPath", [
      "releaseId",
      "locale",
      "publicPath",
    ])
    .index("by_sequence", ["sequence"]),

  /** Exact signed release identity plus bounded operational progress. */
  contentReleases: defineTable({
    abortedAt: v.optional(v.number()),
    abortedRows: v.optional(v.number()),
    abortingAt: v.optional(v.number()),
    articleIndex: v.optional(v.number()),
    articleSyncedAt: v.optional(v.number()),
    cleanupAt: v.optional(v.number()),
    cleanupDeletedArtifacts: v.optional(v.number()),
    cleanupFutureAt: v.optional(v.number()),
    cleanupHash: v.optional(v.string()),
    cleanupRetryAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    proofAt: v.optional(v.number()),
    proofJson: v.optional(v.string()),
    receiptJson: v.optional(v.string()),
    releaseId: v.string(),
    releaseJson: v.string(),
    rendererJson: v.string(),
    role: releaseRoleValidator,
    searchIndex: v.optional(v.number()),
    searchSyncedAt: v.optional(v.number()),
    sequence: v.number(),
    status: releaseStatusValidator,
    updatedAt: v.number(),
    verifiedAt: v.optional(v.number()),
    ...releaseProgress,
  })
    .index("by_releaseId", ["releaseId"])
    .index("by_sequence", ["sequence"])
    .index("by_status_and_sequence", ["status", "sequence"]),

  /** Ordered release changes with immutable prior-version references. */
  contentItems: defineTable({
    artifactHash: v.optional(v.string()),
    artifactBatchHash: v.optional(v.string()),
    artifactBatchIndex: v.optional(v.number()),
    artifactReady: v.boolean(),
    contentKey: v.string(),
    index: v.number(),
    itemBatchHash: v.string(),
    itemBatchIndex: v.number(),
    itemJson: v.string(),
    locale: localeValidator,
    priorSequence: v.optional(v.number()),
    projectionBatchHash: v.optional(v.string()),
    projectionBatchIndex: v.optional(v.number()),
    projectionJson: v.optional(v.string()),
    projectionReady: v.boolean(),
    releaseId: v.string(),
    rollbackJson: v.string(),
    sequence: v.number(),
    stagedAt: v.number(),
  })
    .index("by_releaseId_and_index", ["releaseId", "index"])
    .index("by_releaseId_and_contentKey_and_locale", [
      "releaseId",
      "contentKey",
      "locale",
    ])
    .index("by_releaseId_and_itemBatchIndex", ["releaseId", "itemBatchIndex"])
    .index("by_releaseId_and_artifactBatchIndex", [
      "releaseId",
      "artifactBatchIndex",
    ])
    .index("by_releaseId_and_projectionBatchIndex", [
      "releaseId",
      "projectionBatchIndex",
    ])
    .index("by_artifactHash", ["artifactHash"])
    .index("by_sequence", ["sequence"]),

  ...snapshotSchema,

  /** Singleton identities selecting active, candidate, and recovery sequences. */
  contentState: defineTable({
    activeManifestHash: v.optional(v.string()),
    activeReleaseId: v.optional(v.string()),
    activeSequence: v.optional(v.number()),
    articleManifestHash: v.optional(v.string()),
    articleReleaseId: v.optional(v.string()),
    articleSequence: v.optional(v.number()),
    candidateManifestHash: v.optional(v.string()),
    candidateReleaseId: v.optional(v.string()),
    candidateSequence: v.optional(v.number()),
    compactCursor: v.optional(v.string()),
    compactFloor: v.optional(v.number()),
    compactFrom: v.optional(v.number()),
    compactPhase: v.optional(compactionPhaseValidator),
    compactStartedAt: v.optional(v.number()),
    compactedFloor: v.optional(v.number()),
    key: v.literal("primary"),
    nextSequence: v.number(),
    recoveryManifestHash: v.optional(v.string()),
    recoveryReleaseId: v.optional(v.string()),
    recoverySequence: v.optional(v.number()),
    searchManifestHash: v.optional(v.string()),
    searchReleaseId: v.optional(v.string()),
    searchSequence: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
};

export default tables;
