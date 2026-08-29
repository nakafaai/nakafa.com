import { describe, expect, it } from "@effect/vitest";
import { NAKAFA_MCP_ENDPOINT } from "@repo/contents/_lib/agent/constants";
import { getNakafaMcpUsageMarkdown } from "@repo/contents/_lib/agent/usage";

describe("Nakafa MCP usage resource", () => {
  it("documents the public MCP workflow", () => {
    const usage = getNakafaMcpUsageMarkdown();

    expect(usage).toContain(NAKAFA_MCP_ENDPOINT);
    expect(usage).toContain("nakafa_search_content");
  });
});
