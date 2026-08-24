import { afterEach, describe, expect, it, vi } from "vitest";
import { proxyMcpRequest } from "@/lib/agent-origin";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("local MCP adapter", () => {
  it("forwards local protocol requests to the selected Convex deployment", async () => {
    vi.stubEnv("NAKAFA_CONVEX_SITE_URL", "https://isolated.convex.site");
    vi.stubEnv("NAKAFA_MCP_EDGE_SECRET", "local-mcp-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          Response.json({ id: 1, jsonrpc: "2.0", result: { tools: [] } })
        )
      )
    );

    const response = await proxyMcpRequest(
      new Request("http://localhost:3001/mcp", {
        body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "tools/list" }),
        method: "POST",
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: 1,
      jsonrpc: "2.0",
    });
  });

  it.each([
    {
      configure() {
        vi.stubEnv("NAKAFA_CONVEX_SITE_URL", "");
        vi.stubEnv("NAKAFA_MCP_EDGE_SECRET", "");
      },
      expectedMessage: "The local MCP origin is not configured.",
      request: () => new Request("http://localhost:3001/mcp"),
      status: 503,
    },
    {
      configure() {
        vi.stubEnv("NAKAFA_CONVEX_SITE_URL", "https://isolated.convex.site");
        vi.stubEnv("NAKAFA_MCP_EDGE_SECRET", "local-mcp-secret");
      },
      expectedMessage: "The local MCP adapter only serves /mcp.",
      request: () => new Request("http://localhost:3001/not-mcp"),
      status: 404,
    },
    {
      configure() {
        vi.stubEnv("NAKAFA_CONVEX_SITE_URL", "https://isolated.convex.site");
        vi.stubEnv("NAKAFA_MCP_EDGE_SECRET", "local-mcp-secret");
        vi.stubEnv("VERCEL_ENV", "production");
      },
      expectedMessage:
        "The local MCP adapter is disabled on Vercel production.",
      request: () => new Request("https://mcp.nakafa.com/mcp"),
      status: 503,
    },
    {
      configure() {
        vi.stubEnv("NAKAFA_CONVEX_SITE_URL", "https://isolated.convex.site");
        vi.stubEnv("NAKAFA_MCP_EDGE_SECRET", "local-mcp-secret");
      },
      expectedMessage: "The local MCP request body exceeds two mebibytes.",
      request: () =>
        new Request("http://localhost:3001/mcp", {
          body: new Uint8Array(2 * 1024 * 1024 + 1),
          method: "POST",
        }),
      status: 413,
    },
    {
      configure() {
        vi.stubEnv("NAKAFA_CONVEX_SITE_URL", "https://isolated.convex.site");
        vi.stubEnv("NAKAFA_MCP_EDGE_SECRET", "local-mcp-secret");
      },
      expectedMessage: "The selected local Convex MCP origin is unavailable.",
      request: () => new Request("http://localhost:3001/mcp"),
      status: 503,
    },
  ])(
    "returns JSON-RPC for a local adapter failure",
    async ({ configure, expectedMessage, request, status }) => {
      configure();
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.reject(new Error("unavailable")))
      );

      const response = await proxyMcpRequest(request());

      expect(response.status).toBe(status);
      expect(response.headers.get("mcp-protocol-version")).toBe("2026-07-28");
      await expect(response.json()).resolves.toMatchObject({
        error: { message: expectedMessage },
        id: null,
        jsonrpc: "2.0",
      });
    }
  );
});
