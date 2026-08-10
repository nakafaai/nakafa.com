import { CONTENT_RUNTIME_CACHE_VERSION } from "@repo/backend/scripts/content-runtime/tables";
import { Config, Effect, Redacted } from "effect";
import { contentRuntimeCiError } from "./error";

export const CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT = "dapper-antelope-269";

const HEX_64 = /^[a-f0-9]{64}$/;
const WHITESPACE = /\s/u;

const hasDisallowedDeployKeyCharacter = (value: string) =>
  [...value].some((character) => {
    const codePoint = character.codePointAt(0);

    return (
      WHITESPACE.test(character) ||
      codePoint === undefined ||
      codePoint <= 0x1f ||
      (codePoint >= 0x7f && codePoint <= 0x9f)
    );
  });

export interface CacheIdentity {
  readonly cacheVersion: string;
  readonly contentStateHash: string;
  readonly routeGenerationHash: string;
  readonly runtimeSchemaFingerprint: string;
  readonly sitemapGenerationHash: string;
}

export interface ProductionConfig {
  readonly deployKey: Redacted.Redacted;
  readonly runnerTemp: string;
}

export interface ProductionIdentityConfig
  extends ProductionConfig,
    CacheIdentity {}

export interface ExportConfig extends ProductionIdentityConfig {
  readonly cacheKey: Redacted.Redacted;
  readonly exportLimit: number;
}

export interface ImportConfig extends CacheIdentity {
  readonly cacheKey: Redacted.Redacted;
  readonly runnerTemp: string;
}

const validateHex = (name: string, value: string) => {
  if (HEX_64.test(value)) {
    return Effect.succeed(value);
  }

  return Effect.fail(contentRuntimeCiError(`${name} must be a SHA-256 hash.`));
};

export const validateProductionDeployKey = (deployKey: string) => {
  const parts = deployKey.split("|");
  const identity = parts[0] ?? "";
  const secret = parts[1] ?? "";
  const identitySegments = identity.split(":");
  const deploymentType = identitySegments[0];
  const deploymentName = identitySegments.at(-1);

  if (
    parts.length !== 2 ||
    identitySegments.length < 2 ||
    identitySegments.some(
      (segment) =>
        segment.length === 0 || hasDisallowedDeployKeyCharacter(segment)
    ) ||
    deploymentType !== "prod" ||
    deploymentName !== CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT ||
    secret.length === 0 ||
    hasDisallowedDeployKeyCharacter(secret)
  ) {
    return Effect.fail(
      contentRuntimeCiError(
        "Agent docs requires the exact production-scoped Convex deploy key."
      )
    );
  }

  return Effect.succeed(deployKey);
};

const readCacheIdentity = Effect.gen(function* () {
  const values = yield* Config.all({
    cacheVersion: Config.nonEmptyString("AGENT_DOCS_CONTENT_CACHE_VERSION"),
    contentStateHash: Config.nonEmptyString("AGENT_DOCS_CONTENT_STATE_HASH"),
    routeGenerationHash: Config.nonEmptyString(
      "AGENT_DOCS_ROUTE_GENERATION_HASH"
    ),
    runtimeSchemaFingerprint: Config.nonEmptyString(
      "AGENT_DOCS_RUNTIME_SCHEMA_FINGERPRINT"
    ),
    sitemapGenerationHash: Config.nonEmptyString(
      "AGENT_DOCS_SITEMAP_GENERATION_HASH"
    ),
  });

  if (values.cacheVersion !== CONTENT_RUNTIME_CACHE_VERSION) {
    return yield* contentRuntimeCiError(
      "Invalid content runtime cache version."
    );
  }

  const contentStateHash = yield* validateHex(
    "AGENT_DOCS_CONTENT_STATE_HASH",
    values.contentStateHash
  );
  const routeGenerationHash = yield* validateHex(
    "AGENT_DOCS_ROUTE_GENERATION_HASH",
    values.routeGenerationHash
  );
  const runtimeSchemaFingerprint = yield* validateHex(
    "AGENT_DOCS_RUNTIME_SCHEMA_FINGERPRINT",
    values.runtimeSchemaFingerprint
  );
  const sitemapGenerationHash = yield* validateHex(
    "AGENT_DOCS_SITEMAP_GENERATION_HASH",
    values.sitemapGenerationHash
  );

  return {
    cacheVersion: values.cacheVersion,
    contentStateHash,
    routeGenerationHash,
    runtimeSchemaFingerprint,
    sitemapGenerationHash,
  } satisfies CacheIdentity;
});

export const readProductionConfig = Effect.gen(function* () {
  const deployKey = yield* Config.redacted("CONVEX_DEPLOY_KEY");
  const runnerTemp = yield* Config.nonEmptyString("RUNNER_TEMP");
  yield* validateProductionDeployKey(Redacted.value(deployKey));

  return { deployKey, runnerTemp } satisfies ProductionConfig;
});

export const readProductionIdentityConfig = Effect.gen(function* () {
  const production = yield* readProductionConfig;
  const identity = yield* readCacheIdentity;

  return { ...production, ...identity } satisfies ProductionIdentityConfig;
});

export const readExportConfig = Effect.gen(function* () {
  const productionIdentity = yield* readProductionIdentityConfig;
  const cacheKey = yield* Config.redacted("AGENT_DOCS_CONTENT_CACHE_KEY");
  const exportLimit = yield* Config.integer(
    "CONTENT_RUNTIME_EXPORT_LIMIT"
  ).pipe(Config.withDefault(10_000));

  if (Redacted.value(cacheKey).length < 43) {
    return yield* contentRuntimeCiError(
      "Signed content cache key is missing or too short."
    );
  }
  if (!Number.isSafeInteger(exportLimit) || exportLimit < 1) {
    return yield* contentRuntimeCiError(
      "CONTENT_RUNTIME_EXPORT_LIMIT must be a positive safe integer."
    );
  }

  return { ...productionIdentity, cacheKey, exportLimit };
});

export const readImportConfig = Effect.gen(function* () {
  const identity = yield* readCacheIdentity;
  const cacheKey = yield* Config.redacted("AGENT_DOCS_CONTENT_CACHE_KEY");
  const runnerTemp = yield* Config.nonEmptyString("RUNNER_TEMP");

  if (Redacted.value(cacheKey).length < 43) {
    return yield* contentRuntimeCiError(
      "Signed content cache key is missing or too short."
    );
  }

  return { ...identity, cacheKey, runnerTemp } satisfies ImportConfig;
});

export const clearContentRuntimeSecrets = Effect.sync(() => {
  delete process.env.AGENT_DOCS_CONTENT_CACHE_KEY;
  delete process.env.CONVEX_DEPLOY_KEY;
  delete process.env.CONVEX_DEPLOYMENT_TOKEN;
});
