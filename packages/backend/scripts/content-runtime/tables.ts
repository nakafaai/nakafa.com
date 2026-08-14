import { createHash } from "node:crypto";
import contentReleaseSchema from "@repo/backend/convex/contentRelease/schema";
import { tryoutBundleSchema } from "@repo/backend/convex/tryouts/runtime/schema";
import { Effect, Schema } from "effect";

const ACTIVE_POINTER_TABLE = "contentState";
const TRANSIENT_CUTOVER_TABLES = new Set([
  "contentCutoverActivity",
  "contentCutoverState",
]);
export const CONTENT_RUNTIME_CACHE_VERSION = "v2";
export const CONTENT_RUNTIME_CACHE_CONTRACT = Object.freeze({
  archive: Object.freeze({
    fixedEntries: Object.freeze([
      "manifest.jsonl",
      "metadata.json",
      "tables.txt",
    ]),
    tableEntryPattern: "<table>.jsonl",
    type: "tar-root-v1",
  }),
  encryption: Object.freeze({
    cipher: "AES256",
    compression: "zlib",
    mode: "OpenPGP-OCB",
    s2kDigest: "SHA512",
    s2kMode: 3,
  }),
  manifest: "ordered-json-lines-row-count-sha256-v1",
  portableRows: Object.freeze({
    encoding: "json-lines-v1",
    strippedFields: Object.freeze([
      "_id",
      "_creationTime",
      "proofWorkflowId",
      "syncJobId",
    ]),
  }),
  version: `signed-runtime-cache-${CONTENT_RUNTIME_CACHE_VERSION}`,
});
const { contentState } = contentReleaseSchema;

type RuntimeTableDefinition = readonly [string, object];
type RuntimeTableDefinitionFragment = readonly RuntimeTableDefinition[];

const activePointerDefinition: RuntimeTableDefinition = [
  ACTIVE_POINTER_TABLE,
  contentState,
];
const runtimeTableDefinitionFragments: readonly RuntimeTableDefinitionFragment[] =
  [
    Object.entries(contentReleaseSchema).filter(
      ([table]) =>
        table !== ACTIVE_POINTER_TABLE && !TRANSIENT_CUTOVER_TABLES.has(table)
    ),
    Object.entries(tryoutBundleSchema),
    [activePointerDefinition],
  ];
const runtimeTableDefinitions = runtimeTableDefinitionFragments.flat();

export class DuplicateContentRuntimeTableError extends Schema.TaggedError<DuplicateContentRuntimeTableError>()(
  "DuplicateContentRuntimeTableError",
  {
    table: Schema.String,
  }
) {}

export const validateRuntimeTableDefinitions = Effect.fn(
  "contentRuntime.validateTableDefinitions"
)(function* (tableDefinitions: readonly RuntimeTableDefinition[]) {
  const seenTables = new Set<string>();

  for (const [table] of tableDefinitions) {
    if (seenTables.has(table)) {
      return yield* new DuplicateContentRuntimeTableError({ table });
    }

    seenTables.add(table);
  }

  return tableDefinitions;
});

export const validateContentRuntimeTableDefinitions =
  validateRuntimeTableDefinitions(runtimeTableDefinitions);

/** Signed-runtime tables copied into one isolated local deployment. */
export const CONTENT_RUNTIME_TABLES = Object.freeze(
  runtimeTableDefinitions.map(([table]) => table)
);

export const fingerprintRuntimeSchema = (
  tableDefinitions: ReadonlyArray<readonly [string, object]>
) =>
  createHash("sha256")
    .update(
      JSON.stringify({
        cacheContract: CONTENT_RUNTIME_CACHE_CONTRACT,
        tableDefinitions,
        tableOrder: tableDefinitions.map(([table]) => table),
      })
    )
    .digest("hex");

/** Changes whenever the cached row format or any runtime table contract changes. */
export const CONTENT_RUNTIME_SCHEMA_FINGERPRINT = fingerprintRuntimeSchema(
  runtimeTableDefinitions
);
