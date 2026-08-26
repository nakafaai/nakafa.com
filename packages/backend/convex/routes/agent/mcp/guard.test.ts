// @vitest-environment node

import { NAKAFA_MCP_EDGE_CONTRACT } from "@repo/backend/agent/edge";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  NAKAFA_MCP_SERVER_NAME,
  NAKAFA_MCP_SERVER_VERSION,
} from "@repo/contents/_lib/agent/constants";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "@repo/testing/effect";
import { vi } from "vitest";

const MCP_SECRET = "technical-mcp-edge-secret";
const ORIGINS_ENVIRONMENT = "NAKAFA_MCP_ALLOWED_ORIGINS";

function fetchMcp(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set(NAKAFA_MCP_EDGE_CONTRACT.secretHeader, MCP_SECRET);
  return createConvexTestWithBetterAuth().fetch(
    `${NAKAFA_MCP_EDGE_CONTRACT.originPath}${path}`,
    { ...init, headers }
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
  it("rejects direct origin access before transport dispatch", async () => {
    const response = await createConvexTestWithBetterAuth().fetch(
      NAKAFA_MCP_EDGE_CONTRACT.originPath,
      { method: "POST" }
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        data: { request_id: expect.any(String) },
        message: "Direct access to this Convex MCP origin is not allowed.",
      },
      id: null,
      jsonrpc: "2.0",
    });
  });

  it("accepts exact configured and owned browser Origins", async () => {
    const [configured, owned] = await Promise.all([
      fetchMcp("/health", {
        headers: { origin: "https://agent.example.com" },
      }),
      fetchMcp("/health", { headers: { origin: "https://nakafa.com" } }),
    ]);

    expect(configured.status).toBe(200);
    expect(configured.headers.get("access-control-allow-origin")).toBe(
      "https://agent.example.com"
    );
    expect(configured.headers.get("access-control-allow-credentials")).toBe(
      "true"
    );
    expect(owned.status).toBe(200);
  });

  it("rejects untrusted Origins and malformed origin configuration", async () => {
    const untrusted = await fetchMcp("/health", {
      headers: { origin: "https://evil.example.com" },
    });
    const loopback = await fetchMcp("/health", {
      headers: { origin: "http://localhost:3000" },
    });
    vi.stubEnv(ORIGINS_ENVIRONMENT, "https://agent.example.com/path");
    const malformed = await fetchMcp("/health", {
      headers: { origin: "https://agent.example.com" },
    });

    expect(untrusted.status).toBe(403);
    expect(loopback.status).toBe(403);
    expect(malformed.status).toBe(503);
  });

  it("serves strict browser preflight metadata", async () => {
    const response = await fetchMcp("", {
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
  });

  it("preserves the stable health identity without runtime metadata", async () => {
    const response = await fetchMcp("/health");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      server: {
        name: NAKAFA_MCP_SERVER_NAME,
        version: NAKAFA_MCP_SERVER_VERSION,
      },
      status: "healthy",
      timestamp: expect.any(String),
    });
  });
});
