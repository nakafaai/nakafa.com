import { Schema } from "effect";

export const CONTENT_RUNTIME_ARCHIVE_CONTENT_TYPE =
  "application/vnd.nakafa.runtime-archive";
export const MAX_CONTENT_RUNTIME_ARCHIVE_BYTES = 256 * 1024 * 1024;
export const MAX_CONTENT_RUNTIME_ARCHIVE_CONTROL_BYTES = 2048;
export const MAX_CONTENT_RUNTIME_ARCHIVE_CONTROL_RESPONSE_BYTES = 4096;
export const CONTENT_RUNTIME_ARCHIVE_LEASE_MS = 15 * 60 * 1000;
export const CONTENT_RUNTIME_ARCHIVE_EXPORT_TIMEOUT_MS = 10 * 60 * 1000;

export const ContentRuntimeArchiveHashSchema = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[a-f0-9]{64}$/))
);

export const ContentRuntimeArchiveClaimIdSchema = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
  )
);

export const ContentRuntimeArchiveByteLengthSchema = Schema.Finite.pipe(
  Schema.check(Schema.isInt()),
  Schema.check(Schema.isGreaterThan(0)),
  Schema.check(Schema.isLessThanOrEqualTo(MAX_CONTENT_RUNTIME_ARCHIVE_BYTES))
);

export const ContentRuntimeArchiveIdentitySchema = Schema.Struct({
  runtimeSelectionHash: ContentRuntimeArchiveHashSchema,
  runtimeSchemaFingerprint: ContentRuntimeArchiveHashSchema,
});

export const ContentRuntimeArchiveMetadataSchema = Schema.Struct({
  ...ContentRuntimeArchiveIdentitySchema.fields,
  archiveSha256: ContentRuntimeArchiveHashSchema,
  byteLength: ContentRuntimeArchiveByteLengthSchema,
  createdAt: Schema.Finite.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThan(0))
  ),
  sourceStateHash: ContentRuntimeArchiveHashSchema,
});

export const ContentRuntimeArchiveClaimSchema = Schema.Struct({
  ...ContentRuntimeArchiveIdentitySchema.fields,
  claimId: ContentRuntimeArchiveClaimIdSchema,
});

export const ContentRuntimeArchiveClaimResultSchema = Schema.Union([
  Schema.Struct({
    expiresAt: Schema.Finite.pipe(
      Schema.check(Schema.isInt()),
      Schema.check(Schema.isGreaterThan(0))
    ),
    kind: Schema.Literal("claimed"),
  }),
  Schema.Struct({
    expiresAt: Schema.Finite.pipe(
      Schema.check(Schema.isInt()),
      Schema.check(Schema.isGreaterThan(0))
    ),
    kind: Schema.Literal("busy"),
  }),
  Schema.Struct({
    kind: Schema.Literal("existing"),
    metadata: ContentRuntimeArchiveMetadataSchema,
  }),
]);

export const ContentRuntimeArchiveFinalizeSchema = Schema.Struct({
  ...ContentRuntimeArchiveClaimSchema.fields,
  archiveSha256: ContentRuntimeArchiveHashSchema,
  byteLength: ContentRuntimeArchiveByteLengthSchema,
  sourceStateHash: ContentRuntimeArchiveHashSchema,
  storageId: Schema.Trimmed.pipe(Schema.check(Schema.isNonEmpty())),
});

export const ContentRuntimeArchiveAbortSchema = Schema.Struct({
  ...ContentRuntimeArchiveClaimSchema.fields,
  storageId: Schema.Trimmed.pipe(Schema.check(Schema.isNonEmpty())),
});

export const ContentRuntimeArchiveAbortResultSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("deleted") }),
  Schema.Struct({ kind: Schema.Literal("deferred") }),
  Schema.Struct({
    kind: Schema.Literal("canonical"),
    metadata: ContentRuntimeArchiveMetadataSchema,
  }),
]);

export const ContentRuntimeArchiveReleaseResultSchema = Schema.Struct({
  released: Schema.Boolean,
});

export const ContentRuntimeArchiveUploadSchema = Schema.Struct({
  uploadUrl: Schema.String.pipe(
    Schema.check(
      Schema.makeFilter((value) => URL.canParse(value), {
        message: "Expected a valid URL.",
      })
    )
  ),
});

export const ContentRuntimeArchiveDownloadSchema = Schema.Struct({
  ...ContentRuntimeArchiveMetadataSchema.fields,
  downloadUrl: Schema.String.pipe(
    Schema.check(
      Schema.makeFilter((value) => URL.canParse(value), {
        message: "Expected a valid URL.",
      })
    )
  ),
});

export const ContentRuntimeArchiveFinalizeResultSchema = Schema.Struct({
  kind: Schema.Literals(["stored", "unchanged"]),
  metadata: ContentRuntimeArchiveMetadataSchema,
});

export const ContentRuntimeArchiveStorageResultSchema = Schema.Struct({
  storageId: Schema.Trimmed.pipe(Schema.check(Schema.isNonEmpty())),
});

export const ContentRuntimeArchiveErrorCodeSchema = Schema.Literals([
  "CONTENT_RUNTIME_ARCHIVE_BUSY",
  "CONTENT_RUNTIME_ARCHIVE_CONFLICT",
  "CONTENT_RUNTIME_ARCHIVE_INTERNAL",
  "CONTENT_RUNTIME_ARCHIVE_INVALID",
  "CONTENT_RUNTIME_ARCHIVE_NOT_FOUND",
  "CONTENT_RUNTIME_ARCHIVE_UNAUTHORIZED",
]);

export const ContentRuntimeArchiveErrorSchema = Schema.Struct({
  code: ContentRuntimeArchiveErrorCodeSchema,
});

export type ContentRuntimeArchiveAbort = Schema.Schema.Type<
  typeof ContentRuntimeArchiveAbortSchema
>;
export type ContentRuntimeArchiveClaim = Schema.Schema.Type<
  typeof ContentRuntimeArchiveClaimSchema
>;
export type ContentRuntimeArchiveFinalize = Schema.Schema.Type<
  typeof ContentRuntimeArchiveFinalizeSchema
>;
export type ContentRuntimeArchiveIdentity = Schema.Schema.Type<
  typeof ContentRuntimeArchiveIdentitySchema
>;
export type ContentRuntimeArchiveMetadata = Schema.Schema.Type<
  typeof ContentRuntimeArchiveMetadataSchema
>;
