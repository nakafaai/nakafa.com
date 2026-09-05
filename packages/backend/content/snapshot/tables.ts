import { createHash } from "node:crypto";
import contentReleaseSchema from "@repo/backend/convex/contentRelease/schema";
import { tryoutRuntimeBundleSchema } from "@repo/backend/convex/tryouts/runtime/schema";
import backendPackage from "@repo/backend/package.json" with { type: "json" };
import { Effect, Schema, Struct } from "effect";

const CURRENT_CONTRACT_SPECIFIER = "@nakafa/aksara-contracts";
const CONTRACT_PACKAGE_NAME = "@nakafa/aksara-contracts";
const CurrentContractIdentitySchema = Schema.Struct({
  name: Schema.Literal(CONTRACT_PACKAGE_NAME),
  version: Schema.String,
  specifier: Schema.Literal(CURRENT_CONTRACT_SPECIFIER),
});
type DecoderContractIdentity = typeof CurrentContractIdentitySchema.Type;
const CURRENT_CONTRACT_IDENTITY = Schema.decodeSync(
  CurrentContractIdentitySchema
)({
  name: CONTRACT_PACKAGE_NAME,
  version: backendPackage.dependencies[CURRENT_CONTRACT_SPECIFIER],
  specifier: CURRENT_CONTRACT_SPECIFIER,
});
export const CONTENT_RUNTIME_CACHE_CONTRACT = Object.freeze({
  archive: Object.freeze({
    fixedEntries: Object.freeze([
      "manifest.jsonl",
      "metadata.json",
      "tables.txt",
    ]),
    tableEntryPattern: "<table>.jsonl",
    type: "tar-root",
  }),
  encryption: Object.freeze({
    cipher: "AES256",
    compression: "zlib",
    mode: "OpenPGP-OCB",
    s2kDigest: "SHA512",
    s2kMode: 3,
  }),
  manifest: "ordered-json-lines-row-count-sha256",
  portableRows: Object.freeze({
    encoding: "json-lines",
    selection: "active-static-public",
    strippedFields: Object.freeze([
      "_id",
      "_creationTime",
      "proofWorkflowId",
      "syncJobId",
    ]),
  }),
});
const { contentState } = contentReleaseSchema;

/** Exact read-only serving contract; publication and attempt history stay upstream. */
export const CONTENT_RUNTIME_TABLE_DEFINITIONS = {
  ...Struct.pick(contentReleaseSchema, [
    "contentArtifacts",
    "contentKeys",
    "contentHeads",
    "contentIndex",
    "articleCatalog",
    "articleCategories",
    "articleBuckets",
    "materialCatalog",
    "materialBuckets",
    "contentBindings",
    "contentReleases",
    "contentSnapshots",
    "programCatalog",
    "curriculumRoutes",
    "programBuckets",
    "quranRows",
    "quranSearch",
    "tryoutCatalog",
    "tryoutPlacements",
  ]),
  tryoutRuntimeBundles: tryoutRuntimeBundleSchema.tryoutRuntimeBundles,
  contentState,
};
export type RuntimeTable = keyof typeof CONTENT_RUNTIME_TABLE_DEFINITIONS;
export type RuntimeRow<Table extends RuntimeTable> =
  (typeof CONTENT_RUNTIME_TABLE_DEFINITIONS)[Table]["validator"]["type"];
export type RuntimeTables = {
  readonly [Table in RuntimeTable]: readonly RuntimeRow<Table>[];
};

type RuntimeTableDefinition = readonly [string, object];
const runtimeTableDefinitions = Object.entries(
  CONTENT_RUNTIME_TABLE_DEFINITIONS
);

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
  Struct.keys(CONTENT_RUNTIME_TABLE_DEFINITIONS)
);

export const fingerprintRuntimeSchema = (
  tableDefinitions: ReadonlyArray<readonly [string, object]>,
  decoderContractIdentities: readonly DecoderContractIdentity[]
) =>
  createHash("sha256")
    .update(
      JSON.stringify({
        cacheContract: CONTENT_RUNTIME_CACHE_CONTRACT,
        decoderContractIdentities,
        tableDefinitions,
        tableOrder: tableDefinitions.map(([table]) => table),
      })
    )
    .digest("hex");

/** Reads every exact package identity that decodes JSON inside cached rows. */
export const readContentRuntimeContractIdentities = Effect.fn(
  "contentRuntime.readContractIdentities"
)(() => Effect.succeed([CURRENT_CONTRACT_IDENTITY]));

/** Changes whenever cached rows, tables, or their external decoder changes. */
export const readContentRuntimeSchemaFingerprint = Effect.fn(
  "contentRuntime.readSchemaFingerprint"
)(function* () {
  const contractIdentities = yield* readContentRuntimeContractIdentities();
  return fingerprintRuntimeSchema(runtimeTableDefinitions, contractIdentities);
});
