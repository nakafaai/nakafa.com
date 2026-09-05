import { createHash } from "node:crypto";
import { contentSnapshotError } from "@repo/backend/content/snapshot/error";
import {
  type JsonObject,
  JsonObjectSchema,
} from "@repo/backend/content/snapshot/json";
import type { SnapshotIdentity } from "@repo/backend/content/snapshot/spec";
import {
  SnapshotHashSchema,
  SnapshotMetadataSchema,
} from "@repo/backend/content/snapshot/spec";
import {
  CONTENT_RUNTIME_CACHE_CONTRACT,
  CONTENT_RUNTIME_TABLES,
} from "@repo/backend/content/snapshot/tables";
import { Effect, Schema } from "effect";
export const CONTENT_RUNTIME_CACHE_DIRECTORY = "runtime-cache";
export const CONTENT_RUNTIME_CACHE_FILE = "runtime.tar.gpg";
const ManifestEntrySchema = Schema.Struct({
  rowCount: Schema.Finite.check(Schema.isInt()).check(
    Schema.isGreaterThanOrEqualTo(0)
  ),
  sha256: SnapshotHashSchema,
  table: Schema.Literals(CONTENT_RUNTIME_TABLES),
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
  table: ManifestEntry["table"],
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
export const formatMetadata = (identity: SnapshotIdentity) =>
  `${JSON.stringify(identity)}\n`;
const decodeManifestEntry = (line: string) =>
  Schema.decodeEffect(Schema.fromJsonString(ManifestEntrySchema))(line, {
    onExcessProperty: "error",
  }).pipe(
    Effect.mapError(() =>
      contentSnapshotError("Signed runtime manifest is invalid.")
    )
  );
export const decodeAndValidateManifest = Effect.fn(
  "contentRuntime.validateManifest"
)(function* (text: string) {
  const lines = text.split("\n").filter((line) => line.length > 0);
  const entries = yield* Effect.forEach(lines, decodeManifestEntry);
  if (entries.length !== CONTENT_RUNTIME_TABLES.length) {
    return yield* contentSnapshotError(
      "Signed runtime manifest has an invalid table count."
    );
  }
  for (const [index, table] of CONTENT_RUNTIME_TABLES.entries()) {
    if (entries[index]?.table !== table) {
      return yield* contentSnapshotError(
        "Signed runtime manifest table order is invalid."
      );
    }
  }
  return entries;
});
export const validateMetadata = Effect.fn("contentRuntime.validateMetadata")(
  function* (text: string, expected: SnapshotIdentity) {
    const metadata = yield* Schema.decodeEffect(
      Schema.fromJsonString(SnapshotMetadataSchema)
    )(text, { onExcessProperty: "error" }).pipe(
      Effect.mapError(() =>
        contentSnapshotError("Signed runtime metadata is invalid.")
      )
    );
    if (
      metadata.runtimeSelectionHash !== expected.runtimeSelectionHash ||
      metadata.runtimeSchemaFingerprint !== expected.runtimeSchemaFingerprint
    ) {
      return yield* contentSnapshotError(
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
    return yield* contentSnapshotError(
      `Signed runtime table ${entry.table} failed its integrity check.`
    );
  }
  const rows = yield* Effect.forEach(lines, (line) =>
    Schema.decodeEffect(JsonObjectTextSchema)(line).pipe(
      Effect.mapError(() =>
        contentSnapshotError(
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
    return yield* contentSnapshotError(
      `Signed runtime table ${entry.table} contains non-portable fields.`
    );
  }
  return rows;
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
      contentSnapshotError("Signed runtime archive layout is unsafe.")
    );
  }
  return Effect.void;
};
