import {
  AgentOriginProxyError,
  proxyAgentOriginRequest,
} from "@repo/backend/agent/proxy";
import { afterEach, describe, expect, it, vi } from "@repo/testing/effect";
import { ConfigProvider, Effect } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

const CONVEX_SITE_URL = "https://isolated.convex.site";

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Runs one proxy request with an explicit captured transport. */
function runProxy(
  request: Request,
  surface: "api" | "mcp",
  fetch: typeof globalThis.fetch
) {
  return Effect.runPromise(
    proxyAgentOriginRequest(request, surface).pipe(
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromEnv()
      ),
      Effect.provideService(FetchHttpClient.Fetch, fetch)
    )
  );
}

describe("local agent origin proxy", () => {
  it("forwards API requests to Convex with only the configured edge secret", async () => {
    vi.stubEnv("NAKAFA_CONVEX_SITE_URL", CONVEX_SITE_URL);
    vi.stubEnv("NAKAFA_API_EDGE_SECRET", "configured-api-secret");
    let forwarded: Request | undefined;
    const fetch = vi.fn<typeof globalThis.fetch>((request) => {
      forwarded = new Request(request);
      return Promise.resolve(Response.json({ status: "ok" }));
    });

    const response = await runProxy(
      new Request("http://localhost:3002/v1/search?query=algebra", {
        headers: {
          "accept-encoding": "gzip, deflate",
          connection: "close",
          "x-nakafa-api-edge-secret": "caller-secret",
          "x-nakafa-mcp-edge-secret": "caller-mcp-secret",
        },
      }),
      "api",
      fetch
    );

    expect(response.status).toBe(200);
    expect(forwarded?.url).toBe(
      "https://isolated.convex.site/v1/search?query=algebra"
    );
    expect(forwarded?.headers.get("x-nakafa-api-edge-secret")).toBe(
      "configured-api-secret"
    );
    expect(forwarded?.headers.has("x-nakafa-mcp-edge-secret")).toBe(false);
    expect(forwarded?.headers.has("connection")).toBe(false);
    expect(forwarded?.headers.get("accept-encoding")).toBe("identity");
  });

  it("preserves MCP bodies and browser origins", async () => {
    vi.stubEnv("NAKAFA_CONVEX_SITE_URL", CONVEX_SITE_URL);
    vi.stubEnv("NAKAFA_MCP_EDGE_SECRET", "configured-mcp-secret");
    let forwarded: Request | undefined;
    const fetch = vi.fn<typeof globalThis.fetch>((request) => {
      forwarded = new Request(request);
      return Promise.resolve(Response.json({ jsonrpc: "2.0", result: {} }));
    });
    const body = JSON.stringify({
      id: 1,
      jsonrpc: "2.0",
      method: "tools/list",
    });

    await runProxy(
      new Request("http://localhost:3001/mcp", {
        body,
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3001",
        },
        method: "POST",
      }),
      "mcp",
      fetch
    );

    expect(forwarded?.method).toBe("POST");
    expect(forwarded?.headers.get("origin")).toBe("http://localhost:3001");
    expect(forwarded?.headers.get("x-nakafa-mcp-edge-secret")).toBe(
      "configured-mcp-secret"
    );
    await expect(forwarded?.text()).resolves.toBe(body);
  });

  it("rejects paths outside the selected public surface", async () => {
    vi.stubEnv("NAKAFA_CONVEX_SITE_URL", CONVEX_SITE_URL);
    vi.stubEnv("NAKAFA_MCP_EDGE_SECRET", "configured-mcp-secret");

    await expect(
      runProxy(new Request("http://localhost:3001/not-mcp"), "mcp", vi.fn())
    ).rejects.toMatchObject(
      new AgentOriginProxyError({ reason: "path", surface: "mcp" })
    );
  });

  it("fails closed when local configuration is missing", async () => {
    vi.stubEnv("NAKAFA_CONVEX_SITE_URL", "");
    vi.stubEnv("NAKAFA_API_EDGE_SECRET", "");

    await expect(
      runProxy(new Request("http://localhost:3002/v1"), "api", vi.fn())
    ).rejects.toMatchObject({
      reason: "configuration",
      surface: "api",
    });

    vi.stubEnv("NAKAFA_CONVEX_SITE_URL", CONVEX_SITE_URL);
    await expect(
      runProxy(new Request("http://localhost:3002/v1"), "api", vi.fn())
    ).rejects.toMatchObject({
      reason: "configuration",
      surface: "api",
    });
  });

  it("never becomes a production Vercel application proxy", async () => {
    vi.stubEnv("NAKAFA_CONVEX_SITE_URL", CONVEX_SITE_URL);
    vi.stubEnv("NAKAFA_API_EDGE_SECRET", "configured-api-secret");
    vi.stubEnv("VERCEL_ENV", "production");
    const fetch = vi.fn<typeof globalThis.fetch>();

    await expect(
      runProxy(new Request("https://api.nakafa.com/v1"), "api", fetch)
    ).rejects.toMatchObject({ reason: "production", surface: "api" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("bounds request bodies and maps transport failures", async () => {
    vi.stubEnv("NAKAFA_CONVEX_SITE_URL", CONVEX_SITE_URL);
    vi.stubEnv("NAKAFA_MCP_EDGE_SECRET", "configured-mcp-secret");
    const oversized = new Uint8Array(2 * 1024 * 1024 + 1);
    const unreadable = new Request("http://localhost:3001/mcp", {
      body: "{}",
      method: "POST",
    });
    vi.spyOn(unreadable, "arrayBuffer").mockRejectedValue(
      new Error("unreadable")
    );

    await expect(runProxy(unreadable, "mcp", vi.fn())).rejects.toMatchObject({
      reason: "request-body",
      surface: "mcp",
    });

    await expect(
      runProxy(
        new Request("http://localhost:3001/mcp", {
          body: oversized,
          method: "POST",
        }),
        "mcp",
        vi.fn()
      )
    ).rejects.toMatchObject({ reason: "request-body", surface: "mcp" });

    await expect(
      runProxy(
        new Request("http://localhost:3001/mcp"),
        "mcp",
        vi.fn(() => Promise.reject(new Error("offline")))
      )
    ).rejects.toMatchObject({ reason: "transport", surface: "mcp" });
  });
});
