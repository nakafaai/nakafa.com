import { CONTENT_RUNTIME_CACHE_VERSION } from "@repo/backend/scripts/content/runtime/tables";
import { Config, Effect, Redacted } from "effect";
import { contentRuntimeCiError } from "./error";

export const CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT = "dapper-antelope-269";

/**
 * Largest safe CLI export below Convex's 32,000-row pagination ceiling.
 * Convex CLI adds one row to detect a truncated result.
 * @see https://github.com/get-convex/convex-js/blob/8e20ab9e02baab41969f998122d9b926ec80effd/src/cli/lib/data.ts
 * @see https://github.com/get-convex/convex-backend/blob/ba336a65e20d53a7d4f646efd302af92325112b4/crates/common/src/knobs.rs#L580-L582
 */
export const MAX_CONTENT_RUNTIME_EXPORT_LIMIT = 31_999;

/** Bounded trusted-snapshot capacity for active and retained content history. */
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
  readonly cacheVersion: string;
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
    runtimeSchemaFingerprint: Config.nonEmptyString(
      "AGENT_DOCS_RUNTIME_SCHEMA_FINGERPRINT"
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
  const runtimeSchemaFingerprint = yield* validateHex(
    "AGENT_DOCS_RUNTIME_SCHEMA_FINGERPRINT",
    values.runtimeSchemaFingerprint
  );
  return {
    cacheVersion: values.cacheVersion,
    contentStateHash,
    runtimeSchemaFingerprint,
  } satisfies CacheIdentity;
});

const readRuntimeSelectionIdentity = Effect.gen(function* () {
  const runtimeSelectionHash = yield* Config.nonEmptyString(
    "AGENT_DOCS_RUNTIME_SELECTION_HASH"
  ).pipe(
    Effect.flatMap((value) =>
      validateHex("AGENT_DOCS_RUNTIME_SELECTION_HASH", value)
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
  const cacheKey = yield* Config.redacted("AGENT_DOCS_CONTENT_CACHE_KEY");
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
