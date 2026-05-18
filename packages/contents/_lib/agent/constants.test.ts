import {
  NAKAFA_AGENT_MAX_QUERIES,
  NAKAFA_AGENT_MAX_QURAN_REFERENCE_VERSES,
  NAKAFA_MCP_DIRECT_ENDPOINT,
  NAKAFA_MCP_INFORMATIONAL_ROOT,
  NAKAFA_MCP_RECOMMENDED_ENDPOINT,
} from "@repo/contents/_lib/agent/constants";
import { describe, expect, it } from "vitest";

describe("Nakafa agent constants", () => {
  it("defines public MCP endpoints and bounded Quran reference size", () => {
    expect(NAKAFA_MCP_RECOMMENDED_ENDPOINT).toBe("https://nakafa.com/mcp");
    expect(NAKAFA_MCP_DIRECT_ENDPOINT).toBe("https://mcp.nakafa.com/mcp");
    expect(NAKAFA_MCP_INFORMATIONAL_ROOT).toBe("https://mcp.nakafa.com");
    expect(NAKAFA_AGENT_MAX_QUERIES).toBe(4);
    expect(NAKAFA_AGENT_MAX_QURAN_REFERENCE_VERSES).toBe(20);
  });
});
