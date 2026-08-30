// @vitest-environment node

import { afterEach, describe, expect, it } from "@effect/vitest";
import { NAKAFA_API_EDGE_CONTRACT } from "@repo/backend/agent/edge";
import { hasValidEdgeSecret } from "@repo/backend/convex/routes/agent/security";
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
  return new Request("https://api.nakafa.com/health", { headers });
}

describe("agent edge security", () => {
  it.effect("accepts the current and previous rotation keys", () =>
    Effect.gen(function* () {
      vi.stubEnv(SECRET_NAME, "current-secret,previous-secret");

      expect(
        yield* hasValidEdgeSecret(
          requestWithSecret("current-secret"),
          NAKAFA_API_EDGE_CONTRACT
        )
      ).toBe(true);
      expect(
        yield* hasValidEdgeSecret(
          requestWithSecret("previous-secret"),
          NAKAFA_API_EDGE_CONTRACT
        )
      ).toBe(true);
    })
  );

  it.effect("rejects missing and incorrect request keys", () =>
    Effect.gen(function* () {
      vi.stubEnv(SECRET_NAME, "current-secret");

      expect(
        yield* hasValidEdgeSecret(requestWithSecret(), NAKAFA_API_EDGE_CONTRACT)
      ).toBe(false);
      expect(
        yield* hasValidEdgeSecret(
          requestWithSecret("incorrect-secret"),
          NAKAFA_API_EDGE_CONTRACT
        )
      ).toBe(false);
    })
  );

  it.effect("fails closed for missing or malformed deployment keys", () =>
    Effect.gen(function* () {
      const missing = yield* hasValidEdgeSecret(
        requestWithSecret("supplied"),
        NAKAFA_API_EDGE_CONTRACT
      ).pipe(Effect.result);
      vi.stubEnv(SECRET_NAME, "one,two,three");
      const tooMany = yield* hasValidEdgeSecret(
        requestWithSecret("one"),
        NAKAFA_API_EDGE_CONTRACT
      ).pipe(Effect.result);
      vi.stubEnv(SECRET_NAME, "one,");
      const empty = yield* hasValidEdgeSecret(
        requestWithSecret("one"),
        NAKAFA_API_EDGE_CONTRACT
      ).pipe(Effect.result);

      expect(Result.isFailure(missing)).toBe(true);
      expect(Result.isFailure(tooMany)).toBe(true);
      expect(Result.isFailure(empty)).toBe(true);
    })
  );
});
