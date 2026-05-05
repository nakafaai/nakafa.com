import { Option } from "effect";
import { describe, expect, it } from "vitest";
import {
  getAllowedMcpOrigins,
  getAllowedRequestOrigin,
  withMcpOriginGuard,
} from "@/lib/mcp/origin";

describe("MCP Origin helpers", () => {
  it("resolves default, custom, missing, and invalid Origins", () => {
    const allowed = new Request("https://mcp.nakafa.com/mcp", {
      headers: {
        origin: "https://nakafa.com",
      },
    });
    const custom = new Request("https://mcp.nakafa.com/mcp", {
      headers: {
        origin: "https://agent.example.com",
      },
    });
    const missing = new Request("https://mcp.nakafa.com/mcp");
    const invalid = new Request("https://mcp.nakafa.com/mcp", {
      headers: {
        origin: "not a url",
      },
    });
    const defaultPort = new Request("https://mcp.nakafa.com/mcp", {
      headers: {
        origin: "https://agent.example.com",
      },
    });

    expect(Option.getOrUndefined(getAllowedRequestOrigin(allowed))).toBe(
      "https://nakafa.com"
    );
    expect(
      Option.getOrUndefined(
        getAllowedRequestOrigin(custom, "not a url, https://agent.example.com/")
      )
    ).toBe("https://agent.example.com");
    expect(Option.getOrUndefined(getAllowedRequestOrigin(missing))).toBe("");
    expect(Option.isNone(getAllowedRequestOrigin(invalid))).toBe(true);
    expect(getAllowedMcpOrigins().has("https://nakafa.com")).toBe(true);
    expect(
      getAllowedMcpOrigins("https://agent.example.com/").has(
        "https://agent.example.com"
      )
    ).toBe(true);
    expect(
      Option.getOrUndefined(
        getAllowedRequestOrigin(defaultPort, "https://agent.example.com:443")
      )
    ).toBe("https://agent.example.com");
  });

  it("wraps requests with default Origin handling", async () => {
    const guarded = withMcpOriginGuard(() =>
      Promise.resolve(new Response("ok", { status: 200 }))
    );
    const response = await guarded(
      new Request("https://mcp.nakafa.com/mcp", {
        headers: {
          origin: "https://nakafa.com",
        },
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://nakafa.com"
    );
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
