import { describe, expect, it } from "vitest";

import * as route from "@/app/route";

describe("MCP root route", () => {
  it("explains the canonical and direct MCP endpoints", async () => {
    const response = route.GET();
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/plain; charset=utf-8"
    );
    expect(text).toContain("https://mcp.nakafa.com is informational only");
    expect(text).toContain(
      "Use https://nakafa.com/mcp as the recommended MCP endpoint"
    );
    expect(text).toContain(
      "Use https://mcp.nakafa.com/mcp as the direct MCP endpoint"
    );
  });

  it("does not expose root as a transport endpoint", () => {
    expect("POST" in route).toBe(false);
  });
});
