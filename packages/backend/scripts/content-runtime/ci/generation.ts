import { createHash } from "node:crypto";
import { FileSystem } from "@effect/platform";
import { Effect, Redacted, Schema } from "effect";
import { runConvexData } from "./command";
import type { CacheIdentity, ProductionConfig } from "./config";
import { contentRuntimeCiError } from "./error";
import {
  buildPublicRouteGeneration,
  PUBLIC_ROUTE_STATE_LIMIT,
} from "./public-route-generation";

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
  readonly routeGenerationHash: string;
  readonly sitemapGenerationHash: string;
}

export const verifyRuntimeGenerations = (
  expected: CacheIdentity,
  actual: RuntimeGenerations
) => {
  if (
    expected.contentStateHash === actual.contentStateHash &&
    expected.routeGenerationHash === actual.routeGenerationHash &&
    expected.sitemapGenerationHash === actual.sitemapGenerationHash
  ) {
    return Effect.void;
  }

  return Effect.fail(
    contentRuntimeCiError(
      "Production runtime generations changed during snapshot selection."
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

const readStringField = (row: JsonObject, field: string) =>
  Schema.decodeUnknown(Schema.String)(row[field]).pipe(
    Effect.mapError(() =>
      contentRuntimeCiError(`Production generation row is missing ${field}.`)
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

export const buildRuntimeGenerations = Effect.fn(
  "contentRuntime.buildGenerations"
)(function* (rows: {
  readonly contentState: readonly JsonObject[];
  readonly publicRouteState: readonly JsonObject[];
  readonly routeCounts: readonly JsonObject[];
  readonly sitemapCounts: readonly JsonObject[];
}) {
  if (rows.contentState.length !== 1) {
    return yield* contentRuntimeCiError(
      "Production contentState must contain exactly one row."
    );
  }
  if (rows.routeCounts.length < 1 || rows.routeCounts.length >= 1000) {
    return yield* contentRuntimeCiError(
      "Production contentRouteCounts exceeded its safe read bound."
    );
  }
  if (rows.sitemapCounts.length < 1 || rows.sitemapCounts.length >= 1000) {
    return yield* contentRuntimeCiError(
      "Production publicRouteSitemapCounts exceeded its safe read bound."
    );
  }

  const routeRows = yield* Effect.forEach(rows.routeCounts, (row) =>
    Effect.gen(function* () {
      return {
        locale: yield* readStringField(row, "locale"),
        row: stripSystemFields(row),
        section: yield* readStringField(row, "section"),
      };
    })
  );
  const sitemapRows = yield* Effect.forEach(rows.sitemapCounts, (row) =>
    Effect.gen(function* () {
      return {
        locale: yield* readStringField(row, "locale"),
        row: stripSystemFields(row),
      };
    })
  );
  const publicRouteGeneration = yield* buildPublicRouteGeneration(
    rows.publicRouteState
  );

  routeRows.sort((left, right) =>
    `${left.locale}\u0000${left.section}`.localeCompare(
      `${right.locale}\u0000${right.section}`
    )
  );
  sitemapRows.sort((left, right) => left.locale.localeCompare(right.locale));

  const contentState = rows.contentState[0];
  if (!contentState) {
    return yield* contentRuntimeCiError(
      "Production contentState must contain exactly one row."
    );
  }

  return {
    contentStateHash: yield* hashCanonicalJson(stripSystemFields(contentState)),
    routeGenerationHash: yield* hashCanonicalJson({
      artifactCounts: routeRows.map(({ row }) => row),
      publicRoutes: publicRouteGeneration,
    }),
    sitemapGenerationHash: yield* hashCanonicalJson(
      sitemapRows.map(({ row }) => row)
    ),
  } satisfies RuntimeGenerations;
});

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
  const routeCountsPath = `${tempRoot}/route-counts.json`;
  const publicRouteStatePath = `${tempRoot}/public-route-state.json`;
  const sitemapCountsPath = `${tempRoot}/sitemap-counts.json`;
  const deployKey = Redacted.value(config.deployKey);

  yield* runConvexData({
    deployKey,
    limit: 2,
    logPath,
    outputPath: contentStatePath,
    table: "contentState",
  });
  yield* runConvexData({
    deployKey,
    limit: PUBLIC_ROUTE_STATE_LIMIT,
    logPath,
    outputPath: publicRouteStatePath,
    table: "publicRouteSyncState",
  });
  yield* runConvexData({
    deployKey,
    limit: 1000,
    logPath,
    outputPath: routeCountsPath,
    table: "contentRouteCounts",
  });
  yield* runConvexData({
    deployKey,
    limit: 1000,
    logPath,
    outputPath: sitemapCountsPath,
    table: "publicRouteSitemapCounts",
  });

  const [contentState, publicRouteState, routeCounts, sitemapCounts] =
    yield* Effect.all([
      fileSystem
        .readFileString(contentStatePath)
        .pipe(Effect.flatMap(decodeJsonRows)),
      fileSystem
        .readFileString(publicRouteStatePath)
        .pipe(Effect.flatMap(decodeJsonRows)),
      fileSystem
        .readFileString(routeCountsPath)
        .pipe(Effect.flatMap(decodeJsonRows)),
      fileSystem
        .readFileString(sitemapCountsPath)
        .pipe(Effect.flatMap(decodeJsonRows)),
    ]);

  return yield* buildRuntimeGenerations({
    contentState,
    publicRouteState,
    routeCounts,
    sitemapCounts,
  });
});

export const formatGenerationEnvironment = (generations: RuntimeGenerations) =>
  [
    `AGENT_DOCS_CONTENT_STATE_HASH=${generations.contentStateHash}`,
    `AGENT_DOCS_ROUTE_GENERATION_HASH=${generations.routeGenerationHash}`,
    `AGENT_DOCS_SITEMAP_GENERATION_HASH=${generations.sitemapGenerationHash}`,
  ].join("\n");
