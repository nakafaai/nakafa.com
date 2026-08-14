import { createHash } from "node:crypto";
import { FileSystem } from "@effect/platform";
import { Effect, Redacted, Schema } from "effect";
import { runConvexData } from "./command";
import type { CacheIdentity, ProductionConfig } from "./config";
import { contentRuntimeCiError } from "./error";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export const JsonValueSchema: Schema.Schema<JsonValue> = Schema.suspend(() =>
  Schema.Union(
    Schema.Null,
    Schema.Boolean,
    Schema.JsonNumber,
    Schema.String,
    Schema.Array(JsonValueSchema),
    Schema.Record({ key: Schema.String, value: JsonValueSchema })
  )
);
export const JsonObjectSchema = Schema.Record({
  key: Schema.String,
  value: JsonValueSchema,
});
const JsonRowsTextSchema = Schema.parseJson(Schema.Array(JsonObjectSchema));

export interface RuntimeGenerations {
  readonly contentStateHash: string;
}

/** Proves the current signed pointer did not change during snapshot selection. */
export const verifyRuntimeGenerations = (
  expected: CacheIdentity,
  actual: RuntimeGenerations
) => {
  if (expected.contentStateHash === actual.contentStateHash) {
    return Effect.void;
  }

  return Effect.fail(
    contentRuntimeCiError(
      "Production signed content pointer changed during snapshot selection."
    )
  );
};

export const decodeJsonRows = (text: string) => {
  const source = text.trim().length === 0 ? "[]" : text;

  return Schema.decodeUnknown(JsonRowsTextSchema)(source).pipe(
    Effect.mapError(() =>
      contentRuntimeCiError("Production runtime data is not valid JSON rows.")
    )
  );
};

const stripSystemFields = (row: JsonObject) =>
  Object.fromEntries(
    Object.entries(row).filter(
      ([field]) => field !== "_id" && field !== "_creationTime"
    )
  );

const canonicalizeJson = (value: JsonValue): JsonValue => {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item: JsonValue) => canonicalizeJson(item));
  }

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalizeJson(item)])
  );
};

const hashCanonicalJson = Effect.fn("contentRuntime.hashCanonicalJson")(
  function* (value: JsonValue) {
    const encoded = JSON.stringify(canonicalizeJson(value));
    if (encoded === undefined) {
      return yield* contentRuntimeCiError(
        "Production generation data is not canonical JSON."
      );
    }

    return createHash("sha256").update(encoded).digest("hex");
  }
);

/** Builds the sole mutable generation identity from the signed pointer row. */
export const buildRuntimeGenerations = Effect.fn(
  "contentRuntime.buildGenerations"
)(function* (contentState: readonly JsonObject[]) {
  if (contentState.length !== 1) {
    return yield* contentRuntimeCiError(
      "Production contentState must contain exactly one row."
    );
  }

  const activePointer = contentState[0];
  if (!activePointer) {
    return yield* contentRuntimeCiError(
      "Production contentState must contain exactly one row."
    );
  }

  return {
    contentStateHash: yield* hashCanonicalJson(
      stripSystemFields(activePointer)
    ),
  } satisfies RuntimeGenerations;
});

/** Reads the exact current signed pointer from production. */
export const readProductionGenerations = Effect.fn(
  "contentRuntime.readProductionGenerations"
)(function* (config: ProductionConfig) {
  const fileSystem = yield* FileSystem.FileSystem;
  const tempRoot = yield* fileSystem.makeTempDirectoryScoped({
    directory: config.runnerTemp,
    prefix: "agent-docs-generations-",
  });
  yield* fileSystem.chmod(tempRoot, 0o700);

  const logPath = `${tempRoot}/convex.log`;
  const contentStatePath = `${tempRoot}/content-state.json`;
  yield* runConvexData({
    deployKey: Redacted.value(config.deployKey),
    limit: 2,
    logPath,
    outputPath: contentStatePath,
    table: "contentState",
  });

  const contentState = yield* fileSystem
    .readFileString(contentStatePath)
    .pipe(Effect.flatMap(decodeJsonRows));
  return yield* buildRuntimeGenerations(contentState);
});

export const formatGenerationEnvironment = (generations: RuntimeGenerations) =>
  `AGENT_DOCS_CONTENT_STATE_HASH=${generations.contentStateHash}`;
