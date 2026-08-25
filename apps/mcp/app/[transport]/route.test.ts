import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mcp/server", () => ({
  registerNakafaMcpServer: vi.fn(),
}));
vi.mock("@/env", () => ({
  env: {
    MCP_ALLOWED_ORIGINS: "",
    NEXT_PUBLIC_CONVEX_SITE_URL: "https://example.convex.site",
    NEXT_PUBLIC_CONVEX_URL: "https://example.convex.cloud",
  },
}));

import { GET, POST } from "@/app/[transport]/route";

const DEPLOYED_PROTOCOL_VERSIONS = ["2025-06-18", LATEST_PROTOCOL_VERSION];

describe("deployed MCP transport", () => {
  it.each(DEPLOYED_PROTOCOL_VERSIONS)(
    "negotiates SDK 1.30 protocol %s",
    async (protocolVersion) => {
      const response = await POST(
        new Request("http://localhost:3001/mcp", {
          body: JSON.stringify({
            id: 1,
            jsonrpc: "2.0",
            method: "initialize",
            params: {
              capabilities: {},
              clientInfo: { name: "nakafa-test", version: "1.0.0" },
              protocolVersion,
            },
          }),
          headers: {
            accept: "application/json, text/event-stream",
            "content-type": "application/json",
          },
          method: "POST",
        })
      );
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(body).toContain(`"protocolVersion":"${protocolVersion}"`);
      expect(body).toContain("nakafa-mcp-server");
    }
  );

  it("rejects paths outside the MCP transport", async () => {
    const response = await GET(new Request("http://localhost:3001/unknown"));

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe("Not found");
  });

  it("returns a JSON-RPC method error for non-POST transport requests", async () => {
    const response = await GET(new Request("http://localhost:3001/mcp"));

    expect(response.status).toBe(405);
    expect(response.headers.get("content-type")).toBe("application/json");
    await expect(response.json()).resolves.toEqual({
      error: { code: -32_000, message: "Method not allowed." },
      id: null,
      jsonrpc: "2.0",
    });
  });
});
