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
  it("preserves request content encoding for encoded MCP bodies", async () => {
    const fetchMock = vi.fn((_url: URL, _init: RequestInit) =>
      Promise.resolve(Response.json({ ok: true }))
    );
    vi.stubGlobal("fetch", fetchMock);

    const { POST } = await import("@/app/mcp/route");
    const body = new Uint8Array([31, 139, 8, 0]);

    await POST(
      new Request("https://nakafa.com/mcp?session=1", {
        body,
        headers: {
          "content-encoding": "gzip",
          "content-length": body.byteLength.toString(),
          "content-type": "application/json",
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
    const upstreamHeaders = upstreamInit.headers;

    if (!(upstreamHeaders instanceof Headers)) {
      throw new Error("Expected forwarded headers to use the Headers API");
    }

    expect(upstreamHeaders.get("content-encoding")).toBe("gzip");
    expect(upstreamHeaders.get("content-length")).toBeNull();
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
});
