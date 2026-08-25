import { describe, expect, it } from "vitest";
import { buildDeveloperLlmsIndexText } from "./developers";

describe("developer Markdown", () => {
  it("indexes every canonical developer surface", () => {
    const text = buildDeveloperLlmsIndexText();

    expect(text).toContain("https://api.nakafa.com/v1");
    expect(text).toContain("https://mcp.nakafa.com/mcp");
    expect(text).toContain("nakafa-cli");
    expect(text).toContain("120 data or MCP execution requests per 60 seconds");
    expect(text).toContain("handle HTTP 429 with Retry-After and backoff");
  });
});
