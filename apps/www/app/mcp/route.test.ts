import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/env", () => ({
  env: {
    NEXT_PUBLIC_MCP_URL: "https://mcp.example.com",
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MCP route proxy", () => {
  class UnreadableBodyRequest extends Request {
    override arrayBuffer() {
      return Promise.reject(new Error("body unavailable"));
    }
  }

  it("forwards MCP-safe request headers without browser credentials", async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(Response.json({ ok: true }))
    );
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/mcp/route");
    const body = new Uint8Array([31, 139, 8, 0]);

    await POST(
      new Request("https://nakafa.com/mcp?session=1", {
        body,
        headers: {
          accept: "application/json, text/event-stream",
          authorization: "Bearer user-token",
          cookie: "session=user-session",
          "content-encoding": "gzip",
          "content-length": body.byteLength.toString(),
          "content-type": "application/json",
          "mcp-method": "initialize",
          "mcp-param-region": "us-west1",
          "mcp-protocol-version": "2025-06-18",
          "mcp-session-id": "session-1",
        },
        method: "POST",
      })
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const firstCall = fetchMock.mock.calls[0];
    if (!firstCall) {
      throw new Error("Expected MCP proxy to call fetch");
    }

    const [upstreamUrl, upstreamInit] = firstCall;

    if (!upstreamInit) {
      throw new Error("Expected MCP proxy to pass fetch init options");
    }

    const upstreamHeaders = upstreamInit.headers;

    if (!(upstreamHeaders instanceof Headers)) {
      throw new Error("Expected forwarded headers to use the Headers API");
    }

    expect(upstreamHeaders.get("accept")).toBe(
      "application/json, text/event-stream"
    );
    expect(upstreamHeaders.get("authorization")).toBeNull();
    expect(upstreamHeaders.get("cookie")).toBeNull();
    expect(upstreamHeaders.get("content-encoding")).toBe("gzip");
    expect(upstreamHeaders.get("content-length")).toBeNull();
    expect(upstreamHeaders.get("mcp-method")).toBe("initialize");
    expect(upstreamHeaders.get("mcp-param-region")).toBe("us-west1");
    expect(upstreamHeaders.get("mcp-protocol-version")).toBe("2025-06-18");
    expect(upstreamHeaders.get("mcp-session-id")).toBe("session-1");
    expect(upstreamUrl.toString()).toBe(
      "https://mcp.example.com/mcp?session=1"
    );
  });

  it("removes stale decoded response encoding headers from fetch responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response("decoded", {
            headers: {
              "content-encoding": "gzip",
              "content-length": "37",
              "content-type": "text/plain",
            },
          })
        )
      )
    );

    const { GET } = await import("@/app/mcp/route");
    const response = await GET(new Request("https://nakafa.com/mcp"));

    expect(response.headers.get("content-encoding")).toBeNull();
    expect(response.headers.get("content-length")).toBeNull();
    expect(response.headers.get("content-type")).toBe("text/plain");
    await expect(response.text()).resolves.toBe("decoded");
  });

  it("returns 502 when the request body cannot be read", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/mcp/route");
    const response = await POST(
      new UnreadableBodyRequest("https://nakafa.com/mcp", {
        body: "unreadable",
        method: "POST",
      })
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(502);
    expect(response.headers.get("content-type")).toBe(
      "text/plain; charset=utf-8"
    );
    await expect(response.text()).resolves.toBe("MCP upstream is unavailable");
  });

  it("returns 502 when the upstream request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("upstream unavailable")))
    );

    const { GET } = await import("@/app/mcp/route");
    const response = await GET(new Request("https://nakafa.com/mcp"));

    expect(response.status).toBe(502);
    await expect(response.text()).resolves.toBe("MCP upstream is unavailable");
  });
});
