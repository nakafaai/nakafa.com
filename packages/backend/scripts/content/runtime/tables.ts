import { createHash } from "node:crypto";
import { findPackageJSON } from "node:module";
import contentReleaseSchema from "@repo/backend/convex/contentRelease/schema";
import { tryoutRuntimeBundleSchema } from "@repo/backend/convex/tryouts/runtime/schema";
import { Effect, FileSystem, Schema } from "effect";

const ACTIVE_POINTER_TABLE = "contentState";
const AKSARA_CONTRACTS_PACKAGE = "@nakafa/aksara-contracts";
const AksaraContractsPackageSchema = Schema.Struct({
  name: Schema.Literal(AKSARA_CONTRACTS_PACKAGE),
  version: Schema.String,
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
    strippedFields: Object.freeze([
      "_id",
      "_creationTime",
      "proofWorkflowId",
      "syncJobId",
    ]),
  }),
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
      ([table]) => table !== ACTIVE_POINTER_TABLE
    ),
    Object.entries(tryoutRuntimeBundleSchema),
    [activePointerDefinition],
  ];
const runtimeTableDefinitions = runtimeTableDefinitionFragments.flat();

export class DuplicateContentRuntimeTableError extends Schema.TaggedError<DuplicateContentRuntimeTableError>()(
  "DuplicateContentRuntimeTableError",
  {
    table: Schema.String,
  }
) {}

export class ContentRuntimeContractIdentityError extends Schema.TaggedError<ContentRuntimeContractIdentityError>()(
  "ContentRuntimeContractIdentityError",
  {
    message: Schema.String,
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
  tableDefinitions: ReadonlyArray<readonly [string, object]>,
  decoderContractIdentity: typeof AksaraContractsPackageSchema.Type
) =>
  createHash("sha256")
    .update(
      JSON.stringify({
        cacheContract: CONTENT_RUNTIME_CACHE_CONTRACT,
        decoderContractIdentity,
        tableDefinitions,
        tableOrder: tableDefinitions.map(([table]) => table),
      })
    )
    .digest("hex");

/** Reads the exact package identity that decodes JSON inside cached rows. */
export const readContentRuntimeContractIdentity = Effect.fn(
  "contentRuntime.readContractIdentity"
)(function* () {
  const packageJsonPath = yield* Effect.try({
    catch: () =>
      new ContentRuntimeContractIdentityError({
        message: "Could not resolve the installed Aksara contracts package.",
      }),
    try: () => findPackageJSON(AKSARA_CONTRACTS_PACKAGE, import.meta.url),
  });
  if (packageJsonPath === undefined) {
    return yield* new ContentRuntimeContractIdentityError({
      message: "The installed Aksara contracts package has no package.json.",
    });
  }

  const fileSystem = yield* FileSystem.FileSystem;
  const packageJson = yield* fileSystem.readFileString(packageJsonPath).pipe(
    Effect.mapError(
      () =>
        new ContentRuntimeContractIdentityError({
          message: "Could not read the installed Aksara contracts package.",
        })
    )
  );

  return yield* Schema.decodeEffect(
    Schema.fromJsonString(AksaraContractsPackageSchema)
  )(packageJson).pipe(
    Effect.mapError(
      () =>
        new ContentRuntimeContractIdentityError({
          message:
            "The installed Aksara contracts package has invalid identity metadata.",
        })
    )
  );
});

/** Changes whenever cached rows, tables, or their external decoder changes. */
export const readContentRuntimeSchemaFingerprint = Effect.fn(
  "contentRuntime.readSchemaFingerprint"
)(function* () {
  const contractIdentity = yield* readContentRuntimeContractIdentity();
  return fingerprintRuntimeSchema(runtimeTableDefinitions, contractIdentity);
});
