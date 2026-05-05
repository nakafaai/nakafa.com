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

    expect(Option.getOrUndefined(getAllowedRequestOrigin(allowed))).toBe(
      "https://nakafa.com"
    );
    expect(
      Option.getOrUndefined(
        getAllowedRequestOrigin(custom, "https://agent.example.com")
      )
    ).toBe("https://agent.example.com");
    expect(Option.getOrUndefined(getAllowedRequestOrigin(missing))).toBe("");
    expect(Option.isNone(getAllowedRequestOrigin(invalid))).toBe(true);
    expect(getAllowedMcpOrigins().has("https://nakafa.com")).toBe(true);
    expect(
      getAllowedMcpOrigins("https://agent.example.com").has(
        "https://agent.example.com"
      )
    ).toBe(true);
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
});
