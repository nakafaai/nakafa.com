import {
  appLocaleValidator,
  artifactLocaleValidator,
  curriculumLevelValidator,
  deliveryLanguageValidator,
  snapshotFamilyValidator,
} from "@repo/backend/convex/contentRelease/spec";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
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
        v.literal("bucket"),
        v.literal("quran"),
        v.literal("quran-search"),
        v.literal("bundle"),
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
    appLocale: appLocaleValidator,
    bucket: v.optional(v.string()),
    index: v.number(),
    level: curriculumLevelValidator,
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
    .index("by_snapshotId_and_appLocale_and_path", [
      "snapshotId",
      "appLocale",
      "path",
    ])
    .index("by_snapshotId_and_appLocale_and_bucket_and_path", [
      "snapshotId",
      "appLocale",
      "bucket",
      "path",
    ])
    .index("by_snapshotId_and_appLocale_and_parentPath_and_order_and_path", [
      "snapshotId",
      "appLocale",
      "parentPath",
      "order",
      "path",
    ])
    .index("by_snapshotId_and_appLocale_and_contextPath_and_order_and_path", [
      "snapshotId",
      "appLocale",
      "contextPath",
      "order",
      "path",
    ])
    .index("by_snapshotId_and_appLocale_and_programKey_and_nodeKey", [
      "snapshotId",
      "appLocale",
      "programKey",
      "nodeKey",
    ]),

  /** Non-empty deterministic sitemap partitions for one program snapshot. */
  programBuckets: defineTable({
    appLocale: appLocaleValidator,
    bucket: v.string(),
    index: v.number(),
    routeCount: v.number(),
    snapshotId: v.string(),
  })
    .index("by_snapshotId_and_index", ["snapshotId", "index"])
    .index("by_snapshotId_and_appLocale_and_bucket", [
      "snapshotId",
      "appLocale",
      "bucket",
    ]),

  /** Immutable Quran runtime and search rows selected by a verified snapshot. */
  quranRows: defineTable({
    appLocale: v.optional(appLocaleValidator),
    firstVerse: v.optional(v.number()),
    identity: v.string(),
    index: v.number(),
    kind: v.string(),
    rowHash: v.string(),
    rowJson: v.string(),
    snapshotId: v.string(),
    surahNumber: v.optional(v.number()),
  })
    .index("by_snapshotId_and_index", ["snapshotId", "index"])
    .index("by_snapshotId_and_identity", ["snapshotId", "identity"])
    .index("by_snapshotId_and_kind_and_surahNumber_and_firstVerse", [
      "snapshotId",
      "kind",
      "surahNumber",
      "firstVerse",
    ]),

  /** Full-text index projection resolved back to one signed Quran row. */
  quranSearch: defineTable({
    appLocale: appLocaleValidator,
    /** Temporary additive field until every current snapshot is replayed. */
    assetId: v.optional(v.string()),
    identity: v.string(),
    index: v.number(),
    rowHash: v.string(),
    snapshotId: v.string(),
    surahNumber: v.number(),
    text: v.string(),
  })
    .index("by_snapshotId_and_index", ["snapshotId", "index"])
    .index("by_snapshotId_and_appLocale_and_index", [
      "snapshotId",
      "appLocale",
      "index",
    ])
    .index("by_snapshotId_and_appLocale_and_assetId", [
      "snapshotId",
      "appLocale",
      "assetId",
    ])
    .index("by_snapshotId_and_identity", ["snapshotId", "identity"])
    .searchIndex("search_text", {
      searchField: "text",
      filterFields: ["snapshotId", "appLocale"],
    }),

  /** Immutable localized try-out hierarchy selected by one snapshot. */
  tryoutCatalog: defineTable({
    appLocale: v.optional(appLocaleValidator),
    /** Temporary additive field until every current snapshot is replayed. */
    assetId: v.optional(v.string()),
    identity: v.string(),
    index: v.number(),
    kind: v.string(),
    /** Temporary storage-only source for retained historical rows. */
    locale: v.optional(localeValidator),
    order: v.number(),
    publicPath: v.optional(v.string()),
    rowHash: v.string(),
    rowJson: v.string(),
    setIdentity: v.optional(v.string()),
    snapshotId: v.string(),
  })
    .index("by_snapshotId_and_index", ["snapshotId", "index"])
    .index("by_snapshotId_and_identity", ["snapshotId", "identity"])
    .index("by_snapshotId_and_appLocale_and_publicPath", [
      "snapshotId",
      "appLocale",
      "publicPath",
    ])
    .index("by_snapshotId_and_appLocale_and_assetId", [
      "snapshotId",
      "appLocale",
      "assetId",
    ])
    .index("by_snapshotId_and_locale_and_publicPath", [
      "snapshotId",
      "locale",
      "publicPath",
    ])
    .index("by_snapshotId_and_setIdentity_and_kind_and_order", [
      "snapshotId",
      "setIdentity",
      "kind",
      "order",
    ]),

  /** Immutable attempt placements with terminal answer-artifact bindings. */
  tryoutPlacements: defineTable({
    answerArtifactHash: v.string(),
    answerArtifactLocale: v.optional(artifactLocaleValidator),
    appLocale: v.optional(appLocaleValidator),
    contentHash: v.optional(v.string()),
    countryKey: v.string(),
    deliveryLanguage: v.optional(deliveryLanguageValidator),
    examKey: v.string(),
    identity: v.string(),
    index: v.number(),
    /** Temporary storage-only source for retained historical rows. */
    locale: v.optional(localeValidator),
    questionArtifactHash: v.string(),
    questionArtifactLocale: v.optional(artifactLocaleValidator),
    questionOrder: v.number(),
    rowHash: v.string(),
    rowJson: v.string(),
    snapshotId: v.string(),
    sectionKey: v.string(),
    setKey: v.string(),
    trackKey: v.string(),
  })
    .index("by_snapshotId_and_index", ["snapshotId", "index"])
    .index("by_snapshotId_and_identity", ["snapshotId", "identity"])
    .index("by_snapshotId_and_appLocale_and_section_and_questionOrder", [
      "snapshotId",
      "appLocale",
      "countryKey",
      "examKey",
      "trackKey",
      "setKey",
      "sectionKey",
      "questionOrder",
    ])
    .index("by_snapshotId_and_section_and_questionOrder", [
      "snapshotId",
      "locale",
      "countryKey",
      "examKey",
      "trackKey",
      "setKey",
      "sectionKey",
      "questionOrder",
    ])
    .index("by_snapshotId_and_questionArtifactHash", [
      "snapshotId",
      "questionArtifactHash",
    ])
    .index("by_snapshotId_and_answerArtifactHash", [
      "snapshotId",
      "answerArtifactHash",
    ])
    .index("by_questionArtifactHash", ["questionArtifactHash"])
    .index("by_answerArtifactHash", ["answerArtifactHash"]),
};

export default tables;
