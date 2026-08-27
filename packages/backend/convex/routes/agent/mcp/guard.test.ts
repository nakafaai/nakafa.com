// @vitest-environment node

import { NAKAFA_MCP_EDGE_CONTRACT } from "@repo/backend/agent/edge";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
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
    await expect(response.text()).resolves.toBe("");
  });

  it("accepts exact configured and owned browser Origins", async () => {
    const [configured, owned] = await Promise.all([
      fetchMcp("", {
        headers: { origin: "https://agent.example.com" },
        method: "OPTIONS",
      }),
      fetchMcp("", {
        headers: { origin: "https://nakafa.com" },
        method: "OPTIONS",
      }),
    ]);

    expect(configured.status).toBe(204);
    expect(configured.headers.get("access-control-allow-origin")).toBe(
      "https://agent.example.com"
    );
    expect(configured.headers.get("access-control-allow-credentials")).toBe(
      "true"
    );
    expect(owned.status).toBe(204);
  });

  it("rejects untrusted Origins and malformed origin configuration", async () => {
    const untrusted = await fetchMcp("", {
      headers: { origin: "https://evil.example.com" },
      method: "OPTIONS",
    });
    const loopback = await fetchMcp("", {
      headers: { origin: "http://localhost:3000" },
      method: "OPTIONS",
    });
    vi.stubEnv(ORIGINS_ENVIRONMENT, "https://agent.example.com/path");
    const malformed = await fetchMcp("", {
      headers: { origin: "https://agent.example.com" },
      method: "OPTIONS",
    });

    expect(untrusted.status).toBe(403);
    expect(loopback.status).toBe(403);
    expect(malformed.status).toBe(503);
    for (const response of [untrusted, loopback, malformed]) {
      await expect(response.text()).resolves.toBe("");
    }
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
});
