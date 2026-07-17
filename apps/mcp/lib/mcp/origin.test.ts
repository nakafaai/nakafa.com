import { describe, expect, it } from "vitest";
import { withMcpOriginGuard } from "@/lib/mcp/origin";

describe("MCP Origin helpers", () => {
  it("allows owned, local, and configured Origins", async () => {
    const defaultGuard = withMcpOriginGuard(() =>
      Promise.resolve(new Response("ok", { status: 200 }))
    );
    const customGuard = withMcpOriginGuard(
      () => Promise.resolve(new Response("ok", { status: 200 })),
      "not a url, https://agent.example.com:443/"
    );
    const requests = [
      defaultGuard(
        new Request("https://mcp.nakafa.com/mcp", {
          headers: { origin: "https://nakafa.com" },
        })
      ),
      defaultGuard(
        new Request("https://mcp.nakafa.com/mcp", {
          headers: { origin: "https://api.nakafa.com" },
        })
      ),
      defaultGuard(
        new Request("https://mcp.nakafa.com/mcp", {
          headers: { origin: "https://docs.nakafa.com" },
        })
      ),
      defaultGuard(
        new Request("https://mcp.nakafa.com/mcp", {
          headers: { origin: "http://localhost:3002" },
        })
      ),
      customGuard(
        new Request("https://mcp.nakafa.com/mcp", {
          headers: { origin: "https://agent.example.com" },
        })
      ),
    ];
    const responses = await Promise.all(requests);

    expect(responses.map((response) => response.status)).toEqual([
      200, 200, 200, 200, 200,
    ]);
    expect(
      responses.map((response) =>
        response.headers.get("access-control-allow-origin")
      )
    ).toEqual([
      "https://nakafa.com",
      "https://api.nakafa.com",
      "https://docs.nakafa.com",
      "http://localhost:3002",
      "https://agent.example.com",
    ]);
  });

  it("rejects invalid, untrusted, and insecure Origins", async () => {
    const guarded = withMcpOriginGuard(() =>
      Promise.resolve(new Response("ok", { status: 200 }))
    );
    const responses = await Promise.all(
      ["not a url", "https://evil.example.com", "http://api.nakafa.com"].map(
        (origin) =>
          guarded(
            new Request("https://mcp.nakafa.com/mcp", {
              headers: { origin },
            })
          )
      )
    );

    for (const response of responses) {
      expect(response.status).toBe(403);
      expect(response.headers.get("content-type")).toBe(
        "text/plain; charset=utf-8"
      );
      await expect(response.text()).resolves.toBe("Forbidden MCP Origin");
    }
  });

  it("keeps server-client requests without Origin free of browser CORS headers", async () => {
    const guarded = withMcpOriginGuard(() =>
      Promise.resolve(new Response("ok", { status: 200 }))
    );
    const response = await guarded(new Request("https://mcp.nakafa.com/mcp"));

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    await expect(response.text()).resolves.toBe("ok");
  });

  it("echoes only supported MCP CORS request headers", async () => {
    const guarded = withMcpOriginGuard(() =>
      Promise.resolve(new Response("ok", { status: 200 }))
    );
    const response = await guarded(
      new Request("https://mcp.nakafa.com/mcp", {
        headers: {
          "access-control-request-headers": [
            "content-type",
            "last-event-id",
            "mcp-method",
            "mcp-name",
            "mcp-param-region",
            "mcp-protocol-version",
            "mcp-session-id",
            "x-unsupported",
          ].join(","),
          origin: "https://nakafa.com",
        },
        method: "OPTIONS",
      })
    );
    const allowHeaders = response.headers.get("access-control-allow-headers");

    expect(response.status).toBe(204);
    expect(allowHeaders).toContain("mcp-method");
    expect(allowHeaders).toContain("mcp-name");
    expect(allowHeaders).toContain("mcp-param-region");
    expect(allowHeaders).toContain("last-event-id");
    expect(allowHeaders).not.toContain("x-unsupported");
    expect(response.headers.get("access-control-expose-headers")).toBe(
      "mcp-protocol-version,mcp-session-id"
    );
    expect(response.headers.get("vary")).toBe(
      "Origin, Access-Control-Request-Headers"
    );
  });
});
