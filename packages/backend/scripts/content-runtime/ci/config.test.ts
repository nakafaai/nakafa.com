import {
  CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT,
  clearContentRuntimeSecrets,
  readExportConfig,
  readProductionGenerationConfig,
  validateProductionDeployKey,
} from "@repo/backend/scripts/content-runtime/ci/config";
import { CONTENT_RUNTIME_CACHE_VERSION } from "@repo/backend/scripts/content-runtime/tables";
import { Effect } from "effect";
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

  it.each(["published", "proved-maintenance"])(
    "reads the %s production generation identity",
    async (runtimeMode) => {
      const runtimeGenerationHash = "1".repeat(64);
      stubProductionGeneration(runtimeMode, runtimeGenerationHash);

      await expect(
        Effect.runPromise(readProductionGenerationConfig)
      ).resolves.toMatchObject({ runtimeGenerationHash, runtimeMode });
    }
  );

  it("rejects an invalid runtime mode and generation hash", async () => {
    stubProductionGeneration("invalid", "1".repeat(64));
    await expect(
      Effect.runPromise(readProductionGenerationConfig.pipe(Effect.flip))
    ).resolves.toMatchObject({ _tag: "ContentRuntimeCiError" });

    stubProductionGeneration("published", "not-a-hash");
    await expect(
      Effect.runPromise(readProductionGenerationConfig.pipe(Effect.flip))
    ).resolves.toMatchObject({ _tag: "ContentRuntimeCiError" });
  });

  it("permits cache export only for the matching published identity", async () => {
    const contentStateHash = "1".repeat(64);
    stubProductionGeneration("proved-maintenance", contentStateHash);
    stubCacheIdentity(contentStateHash);
    await expect(
      Effect.runPromise(readExportConfig.pipe(Effect.flip))
    ).resolves.toMatchObject({ _tag: "ContentRuntimeCiError" });

    stubProductionGeneration("published", "2".repeat(64));
    await expect(
      Effect.runPromise(readExportConfig.pipe(Effect.flip))
    ).resolves.toMatchObject({ _tag: "ContentRuntimeCiError" });

    stubProductionGeneration("published", contentStateHash);
    await expect(Effect.runPromise(readExportConfig)).resolves.toMatchObject({
      contentStateHash,
      runtimeGenerationHash: contentStateHash,
      runtimeMode: "published",
    });
  });
});

function stubProductionGeneration(runtimeMode: string, hash: string) {
  vi.stubEnv(
    "CONVEX_DEPLOY_KEY",
    `prod:${CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT}|test-secret`
  );
  vi.stubEnv("RUNNER_TEMP", "/tmp");
  vi.stubEnv("AGENT_DOCS_CONTENT_RUNTIME_MODE", runtimeMode);
  vi.stubEnv("AGENT_DOCS_RUNTIME_GENERATION_HASH", hash);
}

function stubCacheIdentity(contentStateHash: string) {
  vi.stubEnv("AGENT_DOCS_CONTENT_CACHE_KEY", "k".repeat(43));
  vi.stubEnv("AGENT_DOCS_CONTENT_CACHE_VERSION", CONTENT_RUNTIME_CACHE_VERSION);
  vi.stubEnv("AGENT_DOCS_CONTENT_STATE_HASH", contentStateHash);
  vi.stubEnv("AGENT_DOCS_RUNTIME_SCHEMA_FINGERPRINT", "3".repeat(64));
}
