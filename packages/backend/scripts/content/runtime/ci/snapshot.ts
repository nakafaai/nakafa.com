import { createHash } from "node:crypto";
import type { CacheIdentity } from "@repo/backend/scripts/content/runtime/ci/config";
import { contentRuntimeCiError } from "@repo/backend/scripts/content/runtime/ci/error";
import {
  type JsonObject,
  JsonObjectSchema,
} from "@repo/backend/scripts/content/runtime/ci/json";
import {
  CONTENT_RUNTIME_CACHE_CONTRACT,
  CONTENT_RUNTIME_TABLES,
} from "@repo/backend/scripts/content/runtime/tables";
import { Effect, Schema } from "effect";
export const CONTENT_RUNTIME_CACHE_DIRECTORY = "agent-docs-content-cache";
export const CONTENT_RUNTIME_CACHE_FILE = "runtime.tar.gpg";
const HashSchema = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[a-f0-9]{64}$/))
);
const ManifestEntrySchema = Schema.Struct({
  rowCount: Schema.Finite.check(Schema.isInt()).check(
    Schema.isGreaterThanOrEqualTo(0)
  ),
  sha256: HashSchema,
  table: Schema.String,
});
const MetadataSchema = Schema.Struct({
  cacheVersion: Schema.String,
  contentStateHash: HashSchema,
  runtimeSchemaFingerprint: HashSchema,
});
const JsonObjectTextSchema = Schema.fromJsonString(JsonObjectSchema);
export type ManifestEntry = Schema.Schema.Type<typeof ManifestEntrySchema>;
const hashText = (text: string) =>
  createHash("sha256").update(text).digest("hex");
const stripPortableFields = (row: JsonObject) =>
  Object.fromEntries(
    Object.entries(row).filter(
      ([field]) =>
        !CONTENT_RUNTIME_CACHE_CONTRACT.portableRows.strippedFields.some(
          (strippedField) => strippedField === field
        )
    )
  );
export const createPortableTable = (
  table: string,
  rows: readonly JsonObject[]
) => {
  const body = rows
    .map(stripPortableFields)
    .map((row) => JSON.stringify(row))
    .join("\n");
  const jsonLines = body.length === 0 ? "" : `${body}\n`;
  return {
    entry: {
      rowCount: rows.length,
      sha256: hashText(jsonLines),
      table,
    } satisfies ManifestEntry,
    jsonLines,
  };
};
export const formatManifest = (entries: readonly ManifestEntry[]) => {
  const body = entries.map((entry) => JSON.stringify(entry)).join("\n");
  return body.length === 0 ? "" : `${body}\n`;
};
export const formatMetadata = (identity: CacheIdentity) =>
  `${JSON.stringify(identity)}\n`;
const decodeManifestEntry = (line: string) =>
  Schema.decodeEffect(Schema.fromJsonString(ManifestEntrySchema))(line, {
    onExcessProperty: "error",
  }).pipe(
    Effect.mapError(() =>
      contentRuntimeCiError("Signed runtime manifest is invalid.")
    )
  );
export const decodeAndValidateManifest = Effect.fn(
  "contentRuntime.validateManifest"
)(function* (text: string) {
  const lines = text.split("\n").filter((line) => line.length > 0);
  const entries = yield* Effect.forEach(lines, decodeManifestEntry);
  if (entries.length !== CONTENT_RUNTIME_TABLES.length) {
    return yield* contentRuntimeCiError(
      "Signed runtime manifest has an invalid table count."
    );
  }
  for (const [index, table] of CONTENT_RUNTIME_TABLES.entries()) {
    if (entries[index]?.table !== table) {
      return yield* contentRuntimeCiError(
        "Signed runtime manifest table order is invalid."
      );
    }
  }
  return entries;
});
export const validateMetadata = Effect.fn("contentRuntime.validateMetadata")(
  function* (text: string, expected: CacheIdentity) {
    const metadata = yield* Schema.decodeEffect(
      Schema.fromJsonString(MetadataSchema)
    )(text, { onExcessProperty: "error" }).pipe(
      Effect.mapError(() =>
        contentRuntimeCiError("Signed runtime metadata is invalid.")
      )
    );
    if (
      metadata.cacheVersion !== expected.cacheVersion ||
      metadata.contentStateHash !== expected.contentStateHash ||
      metadata.runtimeSchemaFingerprint !== expected.runtimeSchemaFingerprint
    ) {
      return yield* contentRuntimeCiError(
        "Signed runtime metadata does not match the cache identity."
      );
    }
  }
);
export const validatePortableTable = Effect.fn(
  "contentRuntime.validatePortableTable"
)(function* (entry: ManifestEntry, text: string) {
  const lines = text.split("\n").filter((line) => line.length > 0);
  if (lines.length !== entry.rowCount || hashText(text) !== entry.sha256) {
    return yield* contentRuntimeCiError(
      `Signed runtime table ${entry.table} failed its integrity check.`
    );
  }
  const rows = yield* Effect.forEach(lines, (line) =>
    Schema.decodeEffect(JsonObjectTextSchema)(line).pipe(
      Effect.mapError(() =>
        contentRuntimeCiError(
          `Signed runtime table ${entry.table} contains invalid JSON rows.`
        )
      )
    )
  );
  if (
    rows.some((row) =>
      CONTENT_RUNTIME_CACHE_CONTRACT.portableRows.strippedFields.some(
        (field) => field in row
      )
    )
  ) {
    return yield* contentRuntimeCiError(
      `Signed runtime table ${entry.table} contains non-portable fields.`
    );
  }
});
export const getExpectedArchiveEntries = () =>
  [
    "./",
    ...CONTENT_RUNTIME_CACHE_CONTRACT.archive.fixedEntries.map(
      (entry) => `./${entry}`
    ),
    ...CONTENT_RUNTIME_TABLES.map((table) => `./${table}.jsonl`),
  ].sort();
export const validateArchiveListing = (
  listingText: string,
  verboseText: string
) => {
  const expected = getExpectedArchiveEntries();
  const actual = listingText
    .split("\n")
    .filter((line) => line.length > 0)
    .sort();
  const verbose = verboseText.split("\n").filter((line) => line.length > 0);
  if (
    JSON.stringify(actual) !== JSON.stringify(expected) ||
    verbose.length !== expected.length ||
    verbose.some((line) => !(line.startsWith("-") || line.startsWith("d")))
  ) {
    return Effect.fail(
      contentRuntimeCiError("Signed runtime archive layout is unsafe.")
    );
  }
  return Effect.void;
};
