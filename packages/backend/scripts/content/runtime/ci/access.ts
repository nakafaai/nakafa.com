import { CONTENT_RUNTIME_PRODUCTION_SITE_URL } from "@repo/backend/content/deployment";
import {
  type CacheIdentity,
  type ExportConfig,
  readCacheIdentity,
  readExportConfig,
} from "@repo/backend/scripts/content/runtime/ci/config";
import { contentRuntimeCiError } from "@repo/backend/scripts/content/runtime/ci/error";
import { Config, Effect, Redacted } from "effect";

const WHITESPACE = /\s/u;

const hasUnsafeTokenCharacter = (value: string) =>
  [...value].some((character) => {
    const codePoint = character.charCodeAt(0);
    return (
      WHITESPACE.test(character) ||
      codePoint <= 0x1f ||
      (codePoint >= 0x7f && codePoint <= 0x9f)
    );
  });

export interface RuntimeArchiveReadConfig extends CacheIdentity {
  readonly runnerTemp: string;
  readonly runtimeToken: Redacted.Redacted;
  readonly siteUrl: string;
}

export interface RuntimeArchiveWriteConfig extends RuntimeArchiveReadConfig {
  readonly archiveToken: Redacted.Redacted;
}

export interface ProducerConfig
  extends ExportConfig,
    RuntimeArchiveWriteConfig {}

const readRuntimeArchiveAccess = Effect.gen(function* () {
  const identity = yield* readCacheIdentity;
  const runnerTemp = yield* Config.nonEmptyString("RUNNER_TEMP");
  const runtimeToken = yield* Config.redacted("CONTENT_RUNTIME_TOKEN");

  if (hasUnsafeTokenCharacter(Redacted.value(runtimeToken))) {
    return yield* contentRuntimeCiError(
      "Content runtime artifact token is missing or invalid."
    );
  }

  return {
    ...identity,
    runnerTemp,
    runtimeToken,
    siteUrl: CONTENT_RUNTIME_PRODUCTION_SITE_URL,
  } satisfies RuntimeArchiveReadConfig;
});

export const readRuntimeArchiveAccessConfig = readRuntimeArchiveAccess;

export const readProducerConfig = Effect.gen(function* () {
  const exportConfig = yield* readExportConfig;
  const access = yield* readRuntimeArchiveAccess;
  const archiveToken = yield* Config.redacted("CONTENT_ARCHIVE_TOKEN");

  if (hasUnsafeTokenCharacter(Redacted.value(archiveToken))) {
    return yield* contentRuntimeCiError(
      "Content archive producer token is missing or invalid."
    );
  }

  return { ...exportConfig, ...access, archiveToken } satisfies ProducerConfig;
});

export const clearRuntimeArchiveSecrets = Effect.sync(() => {
  delete process.env.CONTENT_ARCHIVE_TOKEN;
  delete process.env.CONTENT_RUNTIME_TOKEN;
});
