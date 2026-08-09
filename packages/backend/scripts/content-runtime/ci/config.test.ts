import {
  CONTENT_RUNTIME_PRODUCTION_DEPLOYMENT,
  validateProductionDeployKey,
} from "@repo/backend/scripts/content-runtime/ci/config";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("content runtime CI config", () => {
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
});
