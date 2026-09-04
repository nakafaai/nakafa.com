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
import { ConfigProvider, Effect } from "effect";

describe("content runtime archive access", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.live("grants archive downloads without the producer credential", () =>
    Effect.gen(function* () {
      stubCacheIdentity("4".repeat(64));
      stubArchiveAccess("runtime-reader-token");

      expect(
        yield* withStubbedEnv(readRuntimeArchiveAccessConfig)
      ).toMatchObject({
        contentStateHash: "4".repeat(64),
        runnerTemp: "/tmp",
        siteUrl: CONTENT_RUNTIME_PRODUCTION_SITE_URL,
      });
      expect(process.env.CONTENT_ARCHIVE_TOKEN).toBeUndefined();
    })
  );

  it.live("requires a separate producer credential for archive writes", () =>
    Effect.gen(function* () {
      stubProductionConfig();
      stubCacheIdentity("5".repeat(64));
      stubArchiveAccess("runtime-reader-token");
      vi.stubEnv("CONTENT_ARCHIVE_TOKEN", "archive-producer-token");

      const config = yield* withStubbedEnv(readProducerConfig);

      expect(config.archiveToken).not.toBe(config.runtimeToken);
      expect(config.siteUrl).toBe(CONTENT_RUNTIME_PRODUCTION_SITE_URL);
    })
  );

  it.live.each([
    { archiveToken: "archive-producer-token", runtimeToken: "invalid token" },
    {
      archiveToken: "archive-producer-token",
      runtimeToken: "invalid\u0001token",
    },
    { archiveToken: "invalid token", runtimeToken: "runtime-reader-token" },
    {
      archiveToken: "invalid\u0080token",
      runtimeToken: "runtime-reader-token",
    },
  ])(
    "rejects unsafe archive credentials before network access: $archiveToken/$runtimeToken",
    ({ archiveToken, runtimeToken }) =>
      Effect.gen(function* () {
        stubProductionConfig();
        stubCacheIdentity("6".repeat(64));
        stubArchiveAccess(runtimeToken);
        vi.stubEnv("CONTENT_ARCHIVE_TOKEN", archiveToken);

        const failure = yield* withStubbedEnv(
          readProducerConfig.pipe(Effect.flip)
        );

        expect(failure).toMatchObject({
          _tag: "ContentRuntimeCiError",
          message:
            runtimeToken === "runtime-reader-token"
              ? "Content archive producer token is missing or invalid."
              : "Content runtime artifact token is missing or invalid.",
        });
      })
  );

  it.live.each([
    { name: "CONTENT_RUNTIME_TOKEN", value: undefined },
    { name: "CONTENT_RUNTIME_TOKEN", value: "" },
    { name: "CONTENT_ARCHIVE_TOKEN", value: undefined },
    { name: "CONTENT_ARCHIVE_TOKEN", value: "" },
  ])("fails closed when $name is absent or empty", ({ name, value }) =>
    Effect.gen(function* () {
      stubProductionConfig();
      stubCacheIdentity("7".repeat(64));
      if (name !== "CONTENT_RUNTIME_TOKEN") {
        stubArchiveAccess("runtime-reader-token");
      }
      if (name !== "CONTENT_ARCHIVE_TOKEN") {
        vi.stubEnv("CONTENT_ARCHIVE_TOKEN", "archive-producer-token");
      }
      if (value !== undefined) {
        vi.stubEnv(name, value);
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
