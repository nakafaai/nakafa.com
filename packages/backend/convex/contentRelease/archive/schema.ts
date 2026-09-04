import { defineTable } from "convex/server";
import { v } from "convex/values";

const tables = {
  /** Immutable encrypted runtime archives keyed by source and schema identity. */
  contentRuntimeArchives: defineTable({
    archiveSha256: v.string(),
    byteLength: v.number(),
    contentStateHash: v.string(),
    createdAt: v.number(),
    runtimeSchemaFingerprint: v.string(),
    storageId: v.id("_storage"),
  })
    .index("by_contentStateHash_and_runtimeSchemaFingerprint", [
      "contentStateHash",
      "runtimeSchemaFingerprint",
    ])
    .index("by_createdAt", ["createdAt"])
    .index("by_storageId", ["storageId"]),

  /** One renewable producer lease for an archive identity that is still absent. */
  contentRuntimeArchiveClaims: defineTable({
    claimId: v.string(),
    contentStateHash: v.string(),
    expiresAt: v.number(),
    runtimeSchemaFingerprint: v.string(),
  })
    .index("by_contentStateHash_and_runtimeSchemaFingerprint", [
      "contentStateHash",
      "runtimeSchemaFingerprint",
    ])
    .index("by_expiresAt", ["expiresAt"]),

  /** Resumable cursor for the bounded orphan storage metadata sweep. */
  contentRuntimeArchiveSweeps: defineTable({
    cursor: v.union(v.null(), v.string()),
    updatedAt: v.number(),
  }),
};

export default tables;
