import { v } from "convex/values";

export const MAX_CONTENT_RUNTIME_ARCHIVES = 32;
export const CONTENT_RUNTIME_ARCHIVE_SWEEP_BATCH_SIZE = 32;

export const runtimeArchiveIdentityValidator = {
  runtimeSelectionHash: v.string(),
  runtimeSchemaFingerprint: v.string(),
};

export const runtimeArchiveMetadataValidator = v.object({
  ...runtimeArchiveIdentityValidator,
  archiveSha256: v.string(),
  byteLength: v.number(),
  createdAt: v.number(),
  sourceStateHash: v.string(),
});

export const runtimeArchiveStoredValidator = v.object({
  ...runtimeArchiveMetadataValidator.fields,
  storageId: v.id("_storage"),
});

export const runtimeArchiveDownloadValidator = v.object({
  ...runtimeArchiveMetadataValidator.fields,
  downloadUrl: v.string(),
});

export const runtimeArchiveClaimResultValidator = v.union(
  v.object({ expiresAt: v.number(), kind: v.literal("claimed") }),
  v.object({ expiresAt: v.number(), kind: v.literal("busy") }),
  v.object({
    kind: v.literal("existing"),
    metadata: runtimeArchiveMetadataValidator,
  })
);

export const runtimeArchiveFinalizeResultValidator = v.union(
  v.object({ kind: v.literal("conflict") }),
  v.object({
    kind: v.union(v.literal("stored"), v.literal("unchanged")),
    metadata: runtimeArchiveMetadataValidator,
  }),
  v.object({ kind: v.literal("invalid") })
);

export const runtimeArchiveAbortResultValidator = v.union(
  v.object({ kind: v.literal("deleted") }),
  v.object({ kind: v.literal("deferred") }),
  v.object({
    kind: v.literal("canonical"),
    metadata: runtimeArchiveMetadataValidator,
  }),
  v.object({ kind: v.literal("invalid") })
);

export const runtimeArchiveReleaseResultValidator = v.object({
  released: v.boolean(),
});

export const runtimeArchiveSweepResultValidator = v.object({
  archivesDeleted: v.number(),
  claimsDeleted: v.number(),
});
