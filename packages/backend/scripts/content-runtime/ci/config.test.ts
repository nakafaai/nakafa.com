import {
  CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT,
  clearContentRuntimeSecrets,
  readExportConfig,
  readProductionSelectionConfig,
  validateProductionDeployKey,
} from "@repo/backend/scripts/content-runtime/ci/config";
import { CONTENT_RUNTIME_CACHE_VERSION } from "@repo/backend/scripts/content-runtime/tables";
import { ConfigProvider, Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("content runtime CI config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    `prod:${CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT}|test-secret`,
    `prod:deployment:data:view:${CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT}|test-secret`,
  ])("accepts an exact production deployment key: %s", (validKey) => {
    expect(Effect.runSync(validateProductionDeployKey(validKey))).toBe(
      validKey
    );
  });

  it.each([
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
  ])("rejects an unsafe deploy key without exposing it", (deployKey) => {
    const failure = Effect.runSync(
      validateProductionDeployKey(deployKey).pipe(Effect.flip)
    );

    expect(failure).toMatchObject({
      _tag: "ContentRuntimeCiError",
      message:
        "Agent docs requires the exact production-scoped Convex deploy key.",
    });
    if (deployKey.length > 0) {
      expect(failure.message).not.toContain(deployKey);
    }
  });

  it("clears every content runtime credential alias", () => {
    const sensitiveValue = "inherited-sensitive-value";
    vi.stubEnv("AGENT_DOCS_CONTENT_CACHE_KEY", sensitiveValue);
    vi.stubEnv("CONVEX_DEPLOY_KEY", sensitiveValue);
    vi.stubEnv("CONVEX_DEPLOYMENT_TOKEN", sensitiveValue);
    vi.stubEnv("CONTENT_RUNTIME_UNRELATED", "preserved-value");

    Effect.runSync(clearContentRuntimeSecrets);

    expect(process.env.AGENT_DOCS_CONTENT_CACHE_KEY).toBeUndefined();
    expect(process.env.CONVEX_DEPLOY_KEY).toBeUndefined();
    expect(process.env.CONVEX_DEPLOYMENT_TOKEN).toBeUndefined();
    expect(process.env.CONTENT_RUNTIME_UNRELATED).toBe("preserved-value");
  });

  it("reads the exact signed runtime export identity", async () => {
    const contentStateHash = "1".repeat(64);
    stubProductionConfig();
    stubCacheIdentity(contentStateHash);
    await expect(runWithStubbedEnv(readExportConfig)).resolves.toMatchObject({
      contentStateHash,
    });
  });

  it("reads the public runtime selection independently", async () => {
    const runtimeSelectionHash = "2".repeat(64);
    stubProductionConfig();
    stubRuntimeSelection(runtimeSelectionHash);

    await expect(
      runWithStubbedEnv(readProductionSelectionConfig)
    ).resolves.toMatchObject({ runtimeSelectionHash });
  });

  it("rejects an invalid public runtime selection identity", async () => {
    stubProductionConfig();
    stubRuntimeSelection("invalid-selection");

    await expect(
      runWithStubbedEnv(readProductionSelectionConfig.pipe(Effect.flip))
    ).resolves.toMatchObject({
      _tag: "ContentRuntimeCiError",
      message: "AGENT_DOCS_RUNTIME_SELECTION_HASH must be a SHA-256 hash.",
    });
  });
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

function runWithStubbedEnv<Value, Error>(program: Effect.Effect<Value, Error>) {
  return Effect.runPromise(
    program.pipe(
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromEnvRecord(process.env)
      )
    )
  );
}
