import {
  CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT,
  clearContentRuntimeSecrets,
  DEFAULT_CONTENT_RUNTIME_EXPORT_LIMIT,
  MAX_CONTENT_RUNTIME_EXPORT_LIMIT,
  readExportConfig,
  readProductionSelectionConfig,
  validateProductionDeployKey,
} from "@repo/backend/scripts/content-runtime/ci/config";
import { CONTENT_RUNTIME_CACHE_VERSION } from "@repo/backend/scripts/content-runtime/tables";
import { afterEach, describe, expect, it } from "@repo/testing/effect";
import { ConfigProvider, Effect } from "effect";
import { vi } from "vitest";

describe("content runtime CI config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.live.each([
    `prod:${CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT}|test-secret`,
    `prod:deployment:data:view:${CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT}|test-secret`,
  ])("accepts an exact production deployment key: %s", (validKey) =>
    Effect.gen(function* () {
      expect(yield* validateProductionDeployKey(validKey)).toBe(validKey);
    })
  );

  it.live.each([
    "",
    "dev:dapper-antelope-269|test-secret",
    "preview:dapper-antelope-269|test-secret",
    "project:dapper-antelope-269|test-secret",
    "dapper-antelope-269|test-secret",
    "prod:other-deployment-123|test-secret",
    "prod:dapper-antelope-269",
    "prod:dapper-antelope-269|test-secret|unexpected",
    "prod::dapper-antelope-269|test-secret",
    "prod:deployment data:view:dapper-antelope-269|test-secret",
    "prod:dapper-antelope-269| test-secret",
    "prod:dapper-antelope-269|test-secret ",
    "prod:dapper-antelope-269|test\nsecret",
  ])("rejects an unsafe deploy key without exposing it", (deployKey) =>
    Effect.gen(function* () {
      const failure = yield* validateProductionDeployKey(deployKey).pipe(
        Effect.flip
      );

      expect(failure).toMatchObject({
        _tag: "ContentRuntimeCiError",
        message:
          "Agent docs requires the exact production-scoped Convex deploy key.",
      });
      if (deployKey.length > 0) {
        expect(failure.message).not.toContain(deployKey);
      }
    })
  );

  it.live("clears every content runtime credential alias", () =>
    Effect.gen(function* () {
      const sensitiveValue = "inherited-sensitive-value";
      vi.stubEnv("AGENT_DOCS_CONTENT_CACHE_KEY", sensitiveValue);
      vi.stubEnv("CONVEX_DEPLOY_KEY", sensitiveValue);
      vi.stubEnv("CONVEX_DEPLOYMENT_TOKEN", sensitiveValue);
      vi.stubEnv("CONTENT_RUNTIME_UNRELATED", "preserved-value");

      yield* clearContentRuntimeSecrets;

      expect(process.env.AGENT_DOCS_CONTENT_CACHE_KEY).toBeUndefined();
      expect(process.env.CONVEX_DEPLOY_KEY).toBeUndefined();
      expect(process.env.CONVEX_DEPLOYMENT_TOKEN).toBeUndefined();
      expect(process.env.CONTENT_RUNTIME_UNRELATED).toBe("preserved-value");
    })
  );

  it.live("reads the exact signed runtime export identity", () =>
    Effect.gen(function* () {
      const contentStateHash = "1".repeat(64);
      stubProductionConfig();
      stubCacheIdentity(contentStateHash);
      expect(yield* withStubbedEnv(readExportConfig)).toMatchObject({
        contentStateHash,
        exportLimit: DEFAULT_CONTENT_RUNTIME_EXPORT_LIMIT,
      });
    })
  );

  it.live("rejects limits above the Convex CLI truncation boundary", () =>
    Effect.gen(function* () {
      stubProductionConfig();
      stubCacheIdentity("1".repeat(64));
      vi.stubEnv(
        "CONTENT_RUNTIME_EXPORT_LIMIT",
        String(MAX_CONTENT_RUNTIME_EXPORT_LIMIT + 1)
      );

      expect(
        yield* withStubbedEnv(readExportConfig.pipe(Effect.flip))
      ).toMatchObject({
        _tag: "ContentRuntimeCiError",
        message: `CONTENT_RUNTIME_EXPORT_LIMIT must be between 1 and ${MAX_CONTENT_RUNTIME_EXPORT_LIMIT}.`,
      });
    })
  );

  it.live("reads the public runtime selection independently", () =>
    Effect.gen(function* () {
      const runtimeSelectionHash = "2".repeat(64);
      stubProductionConfig();
      stubRuntimeSelection(runtimeSelectionHash);

      expect(
        yield* withStubbedEnv(readProductionSelectionConfig)
      ).toMatchObject({
        runtimeSelectionHash,
      });
    })
  );

  it.live("rejects an invalid public runtime selection identity", () =>
    Effect.gen(function* () {
      stubProductionConfig();
      stubRuntimeSelection("invalid-selection");

      expect(
        yield* withStubbedEnv(readProductionSelectionConfig.pipe(Effect.flip))
      ).toMatchObject({
        _tag: "ContentRuntimeCiError",
        message: "AGENT_DOCS_RUNTIME_SELECTION_HASH must be a SHA-256 hash.",
      });
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
  vi.stubEnv("AGENT_DOCS_CONTENT_CACHE_KEY", "k".repeat(43));
  vi.stubEnv("AGENT_DOCS_CONTENT_CACHE_VERSION", CONTENT_RUNTIME_CACHE_VERSION);
  vi.stubEnv("AGENT_DOCS_CONTENT_STATE_HASH", contentStateHash);
  vi.stubEnv("AGENT_DOCS_RUNTIME_SCHEMA_FINGERPRINT", "3".repeat(64));
}

function stubRuntimeSelection(runtimeSelectionHash: string) {
  vi.stubEnv("AGENT_DOCS_RUNTIME_SELECTION_HASH", runtimeSelectionHash);
}

function withStubbedEnv<Value, Error>(program: Effect.Effect<Value, Error>) {
  return program.pipe(
    Effect.provideService(
      ConfigProvider.ConfigProvider,
      ConfigProvider.fromEnvRecord(process.env)
    )
  );
}
