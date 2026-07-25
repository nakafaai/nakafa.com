import {
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
      v.union(v.literal("catalog"), v.literal("placement"))
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

  /** Immutable learning-program rows selected by a verified snapshot. */
  programRows: defineTable({
    index: v.number(),
    rowHash: v.string(),
    rowJson: v.string(),
    snapshotId: v.string(),
  }).index("by_snapshotId_and_index", ["snapshotId", "index"]),

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
