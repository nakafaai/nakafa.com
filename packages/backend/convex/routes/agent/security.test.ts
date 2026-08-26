// @vitest-environment node

import { NAKAFA_API_EDGE_CONTRACT } from "@repo/backend/agent/edge";
import { hasValidApiEdgeSecret } from "@repo/backend/convex/routes/agent/security";
import { afterEach, describe, expect, it } from "@repo/testing/effect";
import { Effect, Result } from "effect";
import { vi } from "vitest";

const SECRET_NAME = NAKAFA_API_EDGE_CONTRACT.secretEnvironment;

afterEach(() => {
  vi.unstubAllEnvs();
});

function requestWithSecret(secret?: string) {
  const headers = new Headers();
  if (secret !== undefined) {
    headers.set(NAKAFA_API_EDGE_CONTRACT.secretHeader, secret);
  }
  return new Request("https://api.nakafa.com/v1/health", { headers });
}

describe("agent edge security", () => {
  it.effect("accepts the current and previous rotation keys", () =>
    Effect.gen(function* () {
      vi.stubEnv(SECRET_NAME, "current-secret,previous-secret");

      expect(
        yield* hasValidApiEdgeSecret(requestWithSecret("current-secret"))
      ).toBe(true);
      expect(
        yield* hasValidApiEdgeSecret(requestWithSecret("previous-secret"))
      ).toBe(true);
    })
  );

  it.effect("rejects missing and incorrect request keys", () =>
    Effect.gen(function* () {
      vi.stubEnv(SECRET_NAME, "current-secret");

      expect(yield* hasValidApiEdgeSecret(requestWithSecret())).toBe(false);
      expect(
        yield* hasValidApiEdgeSecret(requestWithSecret("incorrect-secret"))
      ).toBe(false);
    })
  );

  it.effect("fails closed for missing or malformed deployment keys", () =>
    Effect.gen(function* () {
      const missing = yield* hasValidApiEdgeSecret(
        requestWithSecret("supplied")
      ).pipe(Effect.result);
      vi.stubEnv(SECRET_NAME, "one,two,three");
      const tooMany = yield* hasValidApiEdgeSecret(
        requestWithSecret("one")
      ).pipe(Effect.result);
      vi.stubEnv(SECRET_NAME, "one,");
      const empty = yield* hasValidApiEdgeSecret(requestWithSecret("one")).pipe(
        Effect.result
      );

      expect(Result.isFailure(missing)).toBe(true);
      expect(Result.isFailure(tooMany)).toBe(true);
      expect(Result.isFailure(empty)).toBe(true);
    })
  );
});
