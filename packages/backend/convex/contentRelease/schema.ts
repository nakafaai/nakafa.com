import { vWorkflowId } from "@convex-dev/workflow";
import articleSchema from "@repo/backend/convex/contentRelease/article/schema";
import materialSchema from "@repo/backend/convex/contentRelease/material/schema";
import { proofFailureValidator } from "@repo/backend/convex/contentRelease/proof/spec";
import snapshotSchema from "@repo/backend/convex/contentRelease/snapshot/schema";
import {
  appLocaleValidator,
  artifactLocaleValidator,
  bindingOperationValidator,
  compactionPhaseValidator,
  contentFamilyValidator,
  deliveryValidator,
  headOperationValidator,
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
    artifactLocale: artifactLocaleValidator,
    contentKey: v.string(),
    createdSequence: v.number(),
    family: contentFamilyValidator,
  })
    .index("by_contentKey_and_artifactLocale", [
      "contentKey",
      "artifactLocale",
    ])
    .index("by_createdSequence_and_contentKey_and_artifactLocale", [
      "createdSequence",
      "contentKey",
      "artifactLocale",
    ])
    .index("by_family_and_contentKey_and_artifactLocale", [
      "family",
      "contentKey",
      "artifactLocale",
    ])
    .index("by_family_and_artifactLocale_and_createdSequence_and_contentKey", [
      "family",
      "artifactLocale",
      "createdSequence",
      "contentKey",
    ]),

  /** Permanent public-route identities used for bounded MVCC validation. */
  contentPaths: defineTable({
    appLocale: appLocaleValidator,
    createdSequence: v.number(),
    publicPath: v.string(),
  })
    .index("by_appLocale_and_publicPath", ["appLocale", "publicPath"])
    .index("by_createdSequence_and_appLocale_and_publicPath", [
      "createdSequence",
      "appLocale",
      "publicPath",
    ]),

  /** Immutable content versions selected by the active release sequence. */
  contentHeads: defineTable({
    artifactHash: v.optional(v.string()),
    artifactLocale: artifactLocaleValidator,
    compilerConfigHash: v.optional(v.string()),
    contentKey: v.string(),
    delivery: v.optional(deliveryValidator),
    family: contentFamilyValidator,
    index: v.number(),
    operation: headOperationValidator,
    projectionHash: v.optional(v.string()),
    projectionJson: v.optional(v.string()),
    releaseId: v.string(),
    rendererDomain: v.optional(rendererDomainValidator),
    sequence: v.number(),
    sourceHash: v.optional(v.string()),
    sourcePath: v.optional(v.string()),
  })
    .index("by_contentKey_and_artifactLocale_and_sequence", [
      "contentKey",
      "artifactLocale",
      "sequence",
    ])
    .index("by_releaseId_and_index", ["releaseId", "index"])
    .index("by_releaseId_and_contentKey_and_artifactLocale", [
      "releaseId",
      "contentKey",
      "artifactLocale",
    ])
    .index("by_artifactHash_and_sequence", ["artifactHash", "sequence"])
    .index("by_sequence", ["sequence"]),

  /** One active public search row per locale-specific content identity. */
  contentIndex: defineTable({
    appLocale: appLocaleValidator,
    contentKey: v.string(),
    family: contentFamilyValidator,
    projectionHash: v.string(),
    publicPath: v.string(),
    releaseId: v.string(),
    sequence: v.number(),
    text: v.string(),
  })
    .index("by_contentKey_and_appLocale", ["contentKey", "appLocale"])
    .index("by_appLocale_and_family_and_publicPath", [
      "appLocale",
      "family",
      "publicPath",
    ])
    .searchIndex("search_text", {
      searchField: "text",
      filterFields: ["family", "appLocale"],
    }),

  ...articleSchema,
  ...materialSchema,

  /** Immutable route versions resolved before access policy enforcement. */
  contentBindings: defineTable({
    appLocale: appLocaleValidator,
    batchHash: v.string(),
    batchIndex: v.number(),
    contentKey: v.optional(v.string()),
    index: v.number(),
    operation: bindingOperationValidator,
    publicPath: v.string(),
    releaseId: v.string(),
    routeJson: v.string(),
    sequence: v.number(),
  })
    .index("by_appLocale_and_publicPath_and_sequence_and_index", [
      "appLocale",
      "publicPath",
      "sequence",
      "index",
    ])
    .index("by_releaseId_and_index", ["releaseId", "index"])
    .index("by_releaseId_and_batchIndex", ["releaseId", "batchIndex"])
    .index("by_releaseId_and_appLocale_and_publicPath", [
      "releaseId",
      "appLocale",
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
    baseFamilies: v.array(contentFamilyValidator),
    cleanupAt: v.optional(v.number()),
    cleanupDeletedArtifacts: v.optional(v.number()),
    cleanupFutureAt: v.optional(v.number()),
    cleanupHash: v.optional(v.string()),
    cleanupRetryAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    materialCursor: v.optional(v.string()),
    materialIndex: v.optional(v.number()),
    materialSyncedAt: v.optional(v.number()),
    proofAt: v.optional(v.number()),
    proofFailure: v.optional(proofFailureValidator),
    proofJson: v.optional(v.string()),
    proofWorkflowId: v.optional(vWorkflowId),
    receiptJson: v.optional(v.string()),
    releaseId: v.string(),
    releaseJson: v.string(),
    rendererJson: v.string(),
    resultFamilies: v.array(contentFamilyValidator),
    role: releaseRoleValidator,
    searchIndex: v.optional(v.number()),
    searchSyncedAt: v.optional(v.number()),
    sequence: v.number(),
    status: releaseStatusValidator,
    syncGeneration: v.optional(v.number()),
    syncJobId: v.optional(v.id("_scheduled_functions")),
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
    artifactLocale: artifactLocaleValidator,
    artifactBatchHash: v.optional(v.string()),
    artifactBatchIndex: v.optional(v.number()),
    artifactReady: v.boolean(),
    contentKey: v.string(),
    index: v.number(),
    itemBatchHash: v.string(),
    itemBatchIndex: v.number(),
    itemJson: v.string(),
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
    .index("by_releaseId_and_contentKey_and_artifactLocale", [
      "releaseId",
      "contentKey",
      "artifactLocale",
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
    materialManifestHash: v.optional(v.string()),
    materialReleaseId: v.optional(v.string()),
    materialSequence: v.optional(v.number()),
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
