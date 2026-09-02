import { contentRuntimeCiError } from "@repo/backend/scripts/content/runtime/ci/error";
import { Config, Effect, Redacted } from "effect";

export const CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT = "dapper-antelope-269";

/**
 * Bounded trusted-snapshot capacity for active and retained content history.
 * Production table reads use smaller pages and fail closed at this total cap.
 */
export const MAX_CONTENT_RUNTIME_EXPORT_LIMIT = 100_000;

export const DEFAULT_CONTENT_RUNTIME_EXPORT_LIMIT =
  MAX_CONTENT_RUNTIME_EXPORT_LIMIT;

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
  readonly contentStateHash: string;
  readonly runtimeSchemaFingerprint: string;
}

export interface RuntimeSelectionIdentity {
  readonly runtimeSelectionHash: string;
}

export interface ProductionConfig {
  readonly deployKey: Redacted.Redacted;
  readonly runnerTemp: string;
}

export interface ProductionSelectionConfig
  extends ProductionConfig,
    RuntimeSelectionIdentity {}

export interface ExportConfig extends ProductionConfig, CacheIdentity {
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
        "Content runtime requires the exact production-scoped Convex deploy key."
      )
    );
  }

  return Effect.succeed(deployKey);
};

const readCacheIdentity = Effect.gen(function* () {
  const values = yield* Config.all({
    contentStateHash: Config.nonEmptyString("CONTENT_RUNTIME_STATE_HASH"),
    runtimeSchemaFingerprint: Config.nonEmptyString(
      "CONTENT_RUNTIME_SCHEMA_HASH"
    ),
  });

  const contentStateHash = yield* validateHex(
    "CONTENT_RUNTIME_STATE_HASH",
    values.contentStateHash
  );
  const runtimeSchemaFingerprint = yield* validateHex(
    "CONTENT_RUNTIME_SCHEMA_HASH",
    values.runtimeSchemaFingerprint
  );
  return {
    contentStateHash,
    runtimeSchemaFingerprint,
  } satisfies CacheIdentity;
});

const readRuntimeSelectionIdentity = Effect.gen(function* () {
  const runtimeSelectionHash = yield* Config.nonEmptyString(
    "CONTENT_RUNTIME_SELECTION_HASH"
  ).pipe(
    Effect.flatMap((value) =>
      validateHex("CONTENT_RUNTIME_SELECTION_HASH", value)
    )
  );

  return { runtimeSelectionHash } satisfies RuntimeSelectionIdentity;
});

export const readProductionConfig = Effect.gen(function* () {
  const deployKey = yield* Config.redacted("CONVEX_DEPLOY_KEY");
  const runnerTemp = yield* Config.nonEmptyString("RUNNER_TEMP");
  yield* validateProductionDeployKey(Redacted.value(deployKey));

  return { deployKey, runnerTemp } satisfies ProductionConfig;
});

export const readProductionSelectionConfig = Effect.gen(function* () {
  const production = yield* readProductionConfig;
  const selectionIdentity = yield* readRuntimeSelectionIdentity;

  return {
    ...production,
    ...selectionIdentity,
  } satisfies ProductionSelectionConfig;
});

export const readExportConfig = Effect.gen(function* () {
  const production = yield* readProductionConfig;
  const cacheIdentity = yield* readCacheIdentity;
  const cacheKey = yield* Config.redacted("CONTENT_RUNTIME_CACHE_KEY");
  const exportLimit = yield* Config.int("CONTENT_RUNTIME_EXPORT_LIMIT").pipe(
    Config.withDefault(DEFAULT_CONTENT_RUNTIME_EXPORT_LIMIT)
  );

  if (Redacted.value(cacheKey).length < 43) {
    return yield* contentRuntimeCiError(
      "Signed content cache key is missing or too short."
    );
  }
  if (
    !Number.isSafeInteger(exportLimit) ||
    exportLimit < 1 ||
    exportLimit > MAX_CONTENT_RUNTIME_EXPORT_LIMIT
  ) {
    return yield* contentRuntimeCiError(
      `CONTENT_RUNTIME_EXPORT_LIMIT must be between 1 and ${MAX_CONTENT_RUNTIME_EXPORT_LIMIT}.`
    );
  }
  return { ...production, ...cacheIdentity, cacheKey, exportLimit };
});

export const readImportConfig = Effect.gen(function* () {
  const identity = yield* readCacheIdentity;
  const cacheKey = yield* Config.redacted("CONTENT_RUNTIME_CACHE_KEY");
  const runnerTemp = yield* Config.nonEmptyString("RUNNER_TEMP");

  if (Redacted.value(cacheKey).length < 43) {
    return yield* contentRuntimeCiError(
      "Signed content cache key is missing or too short."
    );
  }

  return { ...identity, cacheKey, runnerTemp } satisfies ImportConfig;
});

export const clearContentRuntimeSecrets = Effect.sync(() => {
  delete process.env.CONTENT_RUNTIME_CACHE_KEY;
  delete process.env.CONVEX_DEPLOY_KEY;
  delete process.env.CONVEX_DEPLOYMENT_TOKEN;
});
