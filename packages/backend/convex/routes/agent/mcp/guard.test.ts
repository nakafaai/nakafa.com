// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { NAKAFA_MCP_EDGE_CONTRACT } from "@repo/backend/agent/edge";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { Effect } from "effect";
import { vi } from "vitest";

const MCP_SECRET = "technical-mcp-edge-secret";
const ORIGINS_ENVIRONMENT = "NAKAFA_MCP_ALLOWED_ORIGINS";

function fetchMcp(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set(NAKAFA_MCP_EDGE_CONTRACT.secretHeader, MCP_SECRET);
  const test = createConvexTestWithBetterAuth();
  return Effect.promise(() =>
    test.fetch(`${NAKAFA_MCP_EDGE_CONTRACT.originPath}${path}`, {
      ...init,
      headers,
    })
  );
}

beforeEach(() => {
  vi.stubEnv(NAKAFA_MCP_EDGE_CONTRACT.secretEnvironment, MCP_SECRET);
  vi.stubEnv(ORIGINS_ENVIRONMENT, "https://agent.example.com");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Nakafa MCP origin guard", () => {
  it.effect("rejects direct origin access before transport dispatch", () =>
    Effect.gen(function* () {
      const test = createConvexTestWithBetterAuth();
      const response = yield* Effect.promise(() =>
        test.fetch(NAKAFA_MCP_EDGE_CONTRACT.originPath, { method: "POST" })
      );

      expect(response.status).toBe(403);
      expect(yield* Effect.promise(() => response.text())).toBe("");
    })
  );

  it.effect("accepts exact configured and owned browser Origins", () =>
    Effect.gen(function* () {
      const [configured, owned] = yield* Effect.all(
        [
          fetchMcp("", {
            headers: { origin: "https://agent.example.com" },
            method: "OPTIONS",
          }),
          fetchMcp("", {
            headers: { origin: "https://nakafa.com" },
            method: "OPTIONS",
          }),
        ],
        { concurrency: "unbounded" }
      );

      expect(configured.status).toBe(204);
      expect(configured.headers.get("access-control-allow-origin")).toBe(
        "https://agent.example.com"
      );
      expect(configured.headers.get("access-control-allow-credentials")).toBe(
        "true"
      );
      expect(owned.status).toBe(204);
    })
  );

  it.effect(
    "rejects untrusted Origins and malformed origin configuration",
    () =>
      Effect.gen(function* () {
        const untrusted = yield* fetchMcp("", {
          headers: { origin: "https://evil.example.com" },
          method: "OPTIONS",
        });
        const loopback = yield* fetchMcp("", {
          headers: { origin: "http://localhost:3000" },
          method: "OPTIONS",
        });
        vi.stubEnv(ORIGINS_ENVIRONMENT, "https://agent.example.com/path");
        const malformed = yield* fetchMcp("", {
          headers: { origin: "https://agent.example.com" },
          method: "OPTIONS",
        });

        expect(untrusted.status).toBe(403);
        expect(loopback.status).toBe(403);
        expect(malformed.status).toBe(503);
        for (const response of [untrusted, loopback, malformed]) {
          expect(yield* Effect.promise(() => response.text())).toBe("");
        }
      })
  );

  it.effect("serves strict browser preflight metadata", () =>
    Effect.gen(function* () {
      const response = yield* fetchMcp("", {
        headers: {
          "access-control-request-headers":
            "content-type,mcp-protocol-version,mcp-param-locale,x-ignored",
          origin: "https://agent.example.com",
        },
        method: "OPTIONS",
      });

      expect(response.status).toBe(204);
      expect(response.headers.get("access-control-allow-origin")).toBe(
        "https://agent.example.com"
      );
      expect(response.headers.get("access-control-allow-methods")).toBe(
        "GET,POST,DELETE,OPTIONS"
      );
      expect(response.headers.get("access-control-allow-headers")).toBe(
        "content-type,mcp-protocol-version,mcp-param-locale"
      );
      expect(response.headers.get("access-control-expose-headers")).toBe(
        "MCP-Protocol-Version,MCP-Session-ID,Retry-After"
      );
      expect(response.headers.get("cache-control")).toBe("no-store");
    })
  );
});
