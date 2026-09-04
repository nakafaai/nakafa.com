import type { ContentRuntimeArchiveIdentity } from "@repo/backend/content/archive";
import { CONTENT_RUNTIME_PRODUCTION_SITE_URL } from "@repo/backend/content/deployment";
import {
  type ExportConfig,
  readExportConfig,
  readRuntimeSchemaIdentity,
  readRuntimeSelectionIdentity,
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

interface RuntimeArchiveConfig extends ContentRuntimeArchiveIdentity {
  readonly runnerTemp: string;
  readonly siteUrl: string;
}

export interface RuntimeArchiveReadConfig extends RuntimeArchiveConfig {
  readonly runtimeToken: Redacted.Redacted;
}

export interface RuntimeArchiveWriteConfig extends RuntimeArchiveConfig {
  readonly archiveToken: Redacted.Redacted;
}

export interface ProducerConfig
  extends ExportConfig,
    RuntimeArchiveWriteConfig {}

const readRuntimeArchiveConfig = Effect.gen(function* () {
  const selection = yield* readRuntimeSelectionIdentity;
  const schema = yield* readRuntimeSchemaIdentity;
  const runnerTemp = yield* Config.nonEmptyString("RUNNER_TEMP");

  return {
    ...selection,
    ...schema,
    runnerTemp,
    siteUrl: CONTENT_RUNTIME_PRODUCTION_SITE_URL,
  } satisfies RuntimeArchiveConfig;
});

export const readRuntimeArchiveAccessConfig = Effect.gen(function* () {
  const config = yield* readRuntimeArchiveConfig;
  const runtimeToken = yield* Config.redacted("CONTENT_RUNTIME_TOKEN");

  if (hasUnsafeTokenCharacter(Redacted.value(runtimeToken))) {
    return yield* contentRuntimeCiError(
      "Content runtime artifact token is missing or invalid."
    );
  }

  return {
    ...config,
    runtimeToken,
  } satisfies RuntimeArchiveReadConfig;
});

export const readProducerConfig = Effect.gen(function* () {
  const exportConfig = yield* readExportConfig;
  const archiveConfig = yield* readRuntimeArchiveConfig;
  const archiveToken = yield* Config.redacted("CONTENT_ARCHIVE_TOKEN");

  if (hasUnsafeTokenCharacter(Redacted.value(archiveToken))) {
    return yield* contentRuntimeCiError(
      "Content archive producer token is missing or invalid."
    );
  }

  return {
    ...exportConfig,
    ...archiveConfig,
    archiveToken,
  } satisfies ProducerConfig;
});

export const clearRuntimeArchiveSecrets = Effect.sync(() => {
  delete process.env.CONTENT_ARCHIVE_TOKEN;
  delete process.env.CONTENT_RUNTIME_TOKEN;
});
