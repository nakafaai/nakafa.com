import {
  curriculumLevelValidator,
  localeValidator,
  snapshotFamilyValidator,
} from "@repo/backend/convex/contentRelease/spec";
import { defineTable } from "convex/server";
import { v } from "convex/values";

const tables = {
  /** Immutable family manifests addressed by one authenticated snapshot ID. */
  contentSnapshots: defineTable({
    cleanupAt: v.optional(v.number()),
    cleanupIndex: v.optional(v.number()),
    cleanupPart: v.optional(
      v.union(
        v.literal("program"),
        v.literal("curriculum"),
        v.literal("catalog"),
        v.literal("placement")
      )
    ),
    cleanupRetryAt: v.optional(v.number()),
    createdAt: v.number(),
    family: snapshotFamilyValidator,
    retainUntil: v.number(),
    snapshotId: v.string(),
    snapshotJson: v.string(),
    verifiedAt: v.optional(v.number()),
  })
    .index("by_family_and_snapshotId", ["family", "snapshotId"])
    .index("by_retainUntil_and_family_and_snapshotId", [
      "retainUntil",
      "family",
      "snapshotId",
    ])
    .index("by_cleanupRetryAt_and_family_and_snapshotId", [
      "cleanupRetryAt",
      "family",
      "snapshotId",
    ]),

  /** Release-owned immutable batch ledger for idempotent snapshot staging. */
  snapshotBatches: defineTable({
    batchHash: v.string(),
    batchIndex: v.number(),
    createdAt: v.number(),
    family: snapshotFamilyValidator,
    firstIndex: v.number(),
    releaseId: v.string(),
    rowCount: v.number(),
    sequence: v.number(),
    snapshotId: v.string(),
  })
    .index("by_releaseId_and_family_and_batchIndex", [
      "releaseId",
      "family",
      "batchIndex",
    ])
    .index("by_sequence_and_family_and_batchIndex", [
      "sequence",
      "family",
      "batchIndex",
    ])
    .index("by_snapshotId_and_family_and_batchIndex", [
      "snapshotId",
      "family",
      "batchIndex",
    ]),

  /** Immutable learning-program identities selected by a verified snapshot. */
  programCatalog: defineTable({
    displayOrder: v.number(),
    index: v.number(),
    programKey: v.string(),
    rowHash: v.string(),
    rowJson: v.string(),
    snapshotId: v.string(),
  })
    .index("by_snapshotId_and_index", ["snapshotId", "index"])
    .index("by_snapshotId_and_programKey", ["snapshotId", "programKey"])
    .index("by_snapshotId_and_displayOrder_and_programKey", [
      "snapshotId",
      "displayOrder",
      "programKey",
    ]),

  /** Immutable localized curriculum routes selected by a verified snapshot. */
  curriculumRoutes: defineTable({
    index: v.number(),
    level: curriculumLevelValidator,
    locale: localeValidator,
    contextPath: v.optional(v.string()),
    materialKey: v.optional(v.string()),
    nodeKey: v.string(),
    order: v.number(),
    parentPath: v.optional(v.string()),
    programKey: v.string(),
    path: v.string(),
    rowHash: v.string(),
    rowJson: v.string(),
    snapshotId: v.string(),
    sourcePath: v.string(),
  })
    .index("by_snapshotId_and_index", ["snapshotId", "index"])
    .index("by_snapshotId_and_locale_and_path", [
      "snapshotId",
      "locale",
      "path",
    ])
    .index("by_snapshotId_and_locale_and_parentPath_and_order_and_path", [
      "snapshotId",
      "locale",
      "parentPath",
      "order",
      "path",
    ])
    .index("by_snapshotId_and_locale_and_contextPath_and_order_and_path", [
      "snapshotId",
      "locale",
      "contextPath",
      "order",
      "path",
    ])
    .index("by_snapshotId_and_locale_and_programKey_and_nodeKey", [
      "snapshotId",
      "locale",
      "programKey",
      "nodeKey",
    ]),

  /** Immutable Quran runtime and search rows selected by a verified snapshot. */
  quranRows: defineTable({
    firstVerse: v.optional(v.number()),
    identity: v.string(),
    index: v.number(),
    kind: v.string(),
    locale: v.optional(localeValidator),
    rowHash: v.string(),
    rowJson: v.string(),
    snapshotId: v.string(),
    surahNumber: v.optional(v.number()),
  })
    .index("by_snapshotId_and_index", ["snapshotId", "index"])
    .index("by_snapshotId_and_identity", ["snapshotId", "identity"]),

  /** Immutable localized try-out hierarchy selected by one snapshot. */
  tryoutCatalog: defineTable({
    identity: v.string(),
    index: v.number(),
    kind: v.string(),
    locale: localeValidator,
    order: v.number(),
    publicPath: v.optional(v.string()),
    rowHash: v.string(),
    rowJson: v.string(),
    snapshotId: v.string(),
  })
    .index("by_snapshotId_and_index", ["snapshotId", "index"])
    .index("by_snapshotId_and_identity", ["snapshotId", "identity"])
    .index("by_snapshotId_and_locale_and_publicPath", [
      "snapshotId",
      "locale",
      "publicPath",
    ]),

  /** Immutable attempt placements with terminal answer-artifact bindings. */
  tryoutPlacements: defineTable({
    answerArtifactHash: v.string(),
    identity: v.string(),
    index: v.number(),
    locale: localeValidator,
    questionArtifactHash: v.string(),
    questionOrder: v.number(),
    rowHash: v.string(),
    rowJson: v.string(),
    snapshotId: v.string(),
  })
    .index("by_snapshotId_and_index", ["snapshotId", "index"])
    .index("by_snapshotId_and_identity", ["snapshotId", "identity"])
    .index("by_questionArtifactHash", ["questionArtifactHash"])
    .index("by_answerArtifactHash", ["answerArtifactHash"]),
};

export default tables;
