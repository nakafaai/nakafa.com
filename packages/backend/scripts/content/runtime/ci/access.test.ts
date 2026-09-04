import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT,
  CONTENT_RUNTIME_PRODUCTION_SITE_URL,
} from "@repo/backend/content/deployment";
import {
  clearRuntimeArchiveSecrets,
  readProducerConfig,
  readRuntimeArchiveAccessConfig,
} from "@repo/backend/scripts/content/runtime/ci/access";
import { ConfigProvider, Effect, Redacted } from "effect";

describe("content runtime archive access", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.live("grants archive downloads without the producer credential", () =>
    Effect.gen(function* () {
      stubArchiveIdentity("4".repeat(64));
      stubArchiveAccess("runtime-reader-token");

      expect(
        yield* withStubbedEnv(readRuntimeArchiveAccessConfig)
      ).toMatchObject({
        runnerTemp: "/tmp",
        runtimeSelectionHash: "4".repeat(64),
        siteUrl: CONTENT_RUNTIME_PRODUCTION_SITE_URL,
      });
      expect(process.env.CONTENT_ARCHIVE_TOKEN).toBeUndefined();
    })
  );

  it.live("requires a separate producer credential for archive writes", () =>
    Effect.gen(function* () {
      stubProductionConfig();
      stubCacheIdentity("5".repeat(64));
      stubArchiveIdentity("6".repeat(64));
      vi.stubEnv("CONTENT_ARCHIVE_TOKEN", "archive-producer-token");

      const config = yield* withStubbedEnv(readProducerConfig);

      expect(Redacted.value(config.archiveToken)).toBe(
        "archive-producer-token"
      );
      expect("runtimeToken" in config).toBe(false);
      expect(process.env.CONTENT_RUNTIME_TOKEN).toBeUndefined();
      expect(config.runtimeSelectionHash).toBe("6".repeat(64));
      expect(config.siteUrl).toBe(CONTENT_RUNTIME_PRODUCTION_SITE_URL);
    })
  );

  it.live.each(["invalid token", "invalid\u0001token"])(
    "rejects unsafe download credentials before network access",
    (token) =>
      Effect.gen(function* () {
        stubArchiveIdentity("6".repeat(64));
        stubArchiveAccess(token);

        const failure = yield* withStubbedEnv(
          readRuntimeArchiveAccessConfig.pipe(Effect.flip)
        );

        expect(failure).toMatchObject({
          _tag: "ContentRuntimeCiError",
          message: "Content runtime artifact token is missing or invalid.",
        });
      })
  );

  it.live.each(["invalid token", "invalid\u0080token"])(
    "rejects unsafe producer credentials before network access",
    (archiveToken) =>
      Effect.gen(function* () {
        stubProductionConfig();
        stubCacheIdentity("6".repeat(64));
        stubArchiveIdentity("7".repeat(64));
        vi.stubEnv("CONTENT_ARCHIVE_TOKEN", archiveToken);

        const failure = yield* withStubbedEnv(
          readProducerConfig.pipe(Effect.flip)
        );

        expect(failure).toMatchObject({
          _tag: "ContentRuntimeCiError",
          message: "Content archive producer token is missing or invalid.",
        });
      })
  );

  it.live.each([undefined, ""])(
    "fails closed when the download credential is absent or empty",
    (value) =>
      Effect.gen(function* () {
        stubArchiveIdentity("7".repeat(64));
        if (value !== undefined) {
          vi.stubEnv("CONTENT_RUNTIME_TOKEN", value);
        }

        expect(
          yield* withStubbedEnv(
            readRuntimeArchiveAccessConfig.pipe(Effect.flip)
          )
        ).toMatchObject({ _tag: "ConfigError" });
      })
  );

  it.live.each([undefined, ""])(
    "fails closed when the producer credential is absent or empty",
    (value) =>
      Effect.gen(function* () {
        stubProductionConfig();
        stubCacheIdentity("7".repeat(64));
        stubArchiveIdentity("8".repeat(64));
        if (value !== undefined) {
          vi.stubEnv("CONTENT_ARCHIVE_TOKEN", value);
        }

        expect(
          yield* withStubbedEnv(readProducerConfig.pipe(Effect.flip))
        ).toMatchObject({ _tag: "ConfigError" });
      })
  );

  it.live("clears archive credentials without widening its ownership", () =>
    Effect.gen(function* () {
      vi.stubEnv("CONTENT_ARCHIVE_TOKEN", "archive-producer-token");
      vi.stubEnv("CONTENT_RUNTIME_TOKEN", "runtime-reader-token");
      vi.stubEnv("CONTENT_RUNTIME_CACHE_KEY", "cache-key");

      yield* clearRuntimeArchiveSecrets;

      expect(process.env.CONTENT_ARCHIVE_TOKEN).toBeUndefined();
      expect(process.env.CONTENT_RUNTIME_TOKEN).toBeUndefined();
      expect(process.env.CONTENT_RUNTIME_CACHE_KEY).toBe("cache-key");
    })
  );
});

function stubProductionConfig() {
  vi.stubEnv(
    "CONVEX_DEPLOY_KEY",
    `prod:${CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT}|test-secret`
  );
  vi.stubEnv("RUNNER_TEMP", "/tmp");
}

function stubCacheIdentity(contentStateHash: string) {
  vi.stubEnv("CONTENT_RUNTIME_CACHE_KEY", "k".repeat(43));
  vi.stubEnv("CONTENT_RUNTIME_STATE_HASH", contentStateHash);
}

function stubArchiveIdentity(runtimeSelectionHash: string) {
  vi.stubEnv("CONTENT_RUNTIME_SELECTION_HASH", runtimeSelectionHash);
  vi.stubEnv("CONTENT_RUNTIME_SCHEMA_HASH", "3".repeat(64));
}

function stubArchiveAccess(runtimeToken: string) {
  vi.stubEnv("RUNNER_TEMP", "/tmp");
  vi.stubEnv("CONTENT_RUNTIME_TOKEN", runtimeToken);
}

function withStubbedEnv<Value, Error>(program: Effect.Effect<Value, Error>) {
  return program.pipe(
    Effect.provideService(
      ConfigProvider.ConfigProvider,
      ConfigProvider.fromEnvRecord(process.env)
    )
  );
}
