import { CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT } from "@repo/backend/content/deployment";
import { contentSnapshotError } from "@repo/backend/content/snapshot/error";
import type {
  RuntimeSelectionIdentity,
  SnapshotIdentity,
} from "@repo/backend/content/snapshot/spec";
import { Config, Effect, Redacted } from "effect";

/** Maximum row count for one encrypted snapshot table. */
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

export interface ProductionConfig {
  readonly deployKey: Redacted.Redacted;
  readonly runnerTemp: string;
}

export interface ProductionSelectionConfig
  extends ProductionConfig,
    RuntimeSelectionIdentity {}

export interface ExportConfig extends ProductionConfig, SnapshotIdentity {
  readonly cacheKey: Redacted.Redacted;
  readonly exportLimit: number;
}

export interface ImportConfig extends SnapshotIdentity {
  readonly cacheKey: Redacted.Redacted;
  readonly runnerTemp: string;
}

const validateHex = (name: string, value: string) => {
  if (HEX_64.test(value)) {
    return Effect.succeed(value);
  }

  return Effect.fail(contentSnapshotError(`${name} must be a SHA-256 hash.`));
};

export const validateProductionDeployKey = (deployKey: string) => {
  const parts = deployKey.split("|");
  const identity = parts[0];
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
      contentSnapshotError(
        "Content runtime requires the exact production-scoped Convex deploy key."
      )
    );
  }

  return Effect.succeed(deployKey);
};

const readSnapshotIdentity = Effect.gen(function* () {
  const values = yield* Config.all({
    runtimeSelectionHash: Config.nonEmptyString(
      "CONTENT_RUNTIME_SELECTION_HASH"
    ),
    runtimeSchemaFingerprint: Config.nonEmptyString(
      "CONTENT_RUNTIME_SCHEMA_HASH"
    ),
  });

  const runtimeSelectionHash = yield* validateHex(
    "CONTENT_RUNTIME_SELECTION_HASH",
    values.runtimeSelectionHash
  );
  const runtimeSchemaFingerprint = yield* validateHex(
    "CONTENT_RUNTIME_SCHEMA_HASH",
    values.runtimeSchemaFingerprint
  );
  return {
    runtimeSelectionHash,
    runtimeSchemaFingerprint,
  } satisfies SnapshotIdentity;
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
  const snapshotIdentity = yield* readSnapshotIdentity;
  const cacheKey = yield* Config.redacted("CONTENT_RUNTIME_CACHE_KEY");
  const exportLimit = yield* Config.int("CONTENT_RUNTIME_EXPORT_LIMIT").pipe(
    Config.withDefault(DEFAULT_CONTENT_RUNTIME_EXPORT_LIMIT)
  );

  if (Redacted.value(cacheKey).length < 43) {
    return yield* contentSnapshotError(
      "Signed content cache key is missing or too short."
    );
  }
  if (
    !Number.isSafeInteger(exportLimit) ||
    exportLimit < 1 ||
    exportLimit > MAX_CONTENT_RUNTIME_EXPORT_LIMIT
  ) {
    return yield* contentSnapshotError(
      `CONTENT_RUNTIME_EXPORT_LIMIT must be between 1 and ${MAX_CONTENT_RUNTIME_EXPORT_LIMIT}.`
    );
  }
  return { ...production, ...snapshotIdentity, cacheKey, exportLimit };
});

export const readImportConfig = Effect.gen(function* () {
  const identity = yield* readSnapshotIdentity;
  const cacheKey = yield* Config.redacted("CONTENT_RUNTIME_CACHE_KEY");
  const runnerTemp = yield* Config.nonEmptyString("RUNNER_TEMP");

  if (Redacted.value(cacheKey).length < 43) {
    return yield* contentSnapshotError(
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
