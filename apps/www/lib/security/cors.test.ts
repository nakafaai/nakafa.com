// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect } from "effect";
import {
  createCorsForbiddenResponse,
  isCorsRequestAllowed,
} from "@/lib/security/cors";

const developmentConfig = ConfigProvider.fromEnvRecord({
  NODE_ENV: "development",
});
const productionConfig = ConfigProvider.fromEnvRecord({
  NODE_ENV: "production",
});

function checkRequest(headers: HeadersInit, provider = productionConfig) {
  return isCorsRequestAllowed(
    new Request("https://nakafa.com/api/chat", { headers })
  ).pipe(Effect.provideService(ConfigProvider.ConfigProvider, provider));
}

describe("WWW CORS policy", () => {
  it.effect("allows Nakafa and its HTTPS subdomains", () =>
    Effect.gen(function* () {
      expect(yield* checkRequest({ origin: "https://nakafa.com" })).toBe(true);
      expect(yield* checkRequest({ origin: "https://api.nakafa.com" })).toBe(
        true
      );
      expect(
        yield* checkRequest({ referer: "https://nakafa.com/en/chat" })
      ).toBe(true);
    })
  );

  it.effect("rejects malformed, insecure, and lookalike origins", () =>
    Effect.gen(function* () {
      for (const origin of [
        "not-a-url",
        "http://nakafa.com",
        "https://nakafa.com:8443",
        "https://nakafa.com.example.com",
      ]) {
        expect(yield* checkRequest({ origin })).toBe(false);
      }
    })
  );

  it.effect("does not let Referer override a rejected Origin", () =>
    Effect.gen(function* () {
      const allowed = yield* checkRequest({
        origin: "https://example.com",
        referer: "https://nakafa.com/en/chat",
      });
      expect(allowed).toBe(false);
    })
  );

  it.effect("allows exact local origins only in development", () =>
    Effect.gen(function* () {
      expect(
        yield* checkRequest(
          { origin: "http://localhost:3000" },
          developmentConfig
        )
      ).toBe(true);
      expect(yield* checkRequest({ origin: "http://localhost:3000" })).toBe(
        false
      );
      expect(
        yield* checkRequest(
          { origin: "http://localhost:3999" },
          developmentConfig
        )
      ).toBe(false);
    })
  );

  it.effect("fails closed when origin evidence is absent", () =>
    Effect.gen(function* () {
      expect(yield* checkRequest({})).toBe(false);
    })
  );

  it.effect("creates one plain forbidden response", () =>
    Effect.gen(function* () {
      const response = createCorsForbiddenResponse();

      expect(response.status).toBe(403);
      expect(response.headers.get("content-type")).toBe("text/plain");
      expect(yield* Effect.promise(() => response.text())).toBe(
        "Access denied."
      );
    })
  );
});
