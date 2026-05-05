import {
  NAKAFA_MCP_DIRECT_ENDPOINT,
  NAKAFA_MCP_RECOMMENDED_ENDPOINT,
} from "@repo/contents/_lib/agent/constants";
import { getNakafaMcpUsageMarkdown } from "@repo/contents/_lib/agent/usage";
import { describe, expect, it } from "vitest";

describe("Nakafa MCP usage resource", () => {
  it("documents the public MCP workflow", () => {
    const usage = getNakafaMcpUsageMarkdown();

    expect(usage).toContain(NAKAFA_MCP_RECOMMENDED_ENDPOINT);
    expect(usage).toContain(NAKAFA_MCP_DIRECT_ENDPOINT);
    expect(usage).toContain("nakafa_search_content");
  });
});
