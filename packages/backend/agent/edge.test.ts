import {
  NAKAFA_API_EDGE_CONTRACT,
  NAKAFA_MCP_EDGE_CONTRACT,
  projectPublicApiPath,
} from "@repo/backend/agent/edge";
import { describe, expect, it } from "vitest";

describe("agent edge contract", () => {
  it("owns one server-only Convex origin environment", () => {
    expect(NAKAFA_API_EDGE_CONTRACT.originEnvironment).toBe(
      "NAKAFA_CONVEX_SITE_URL"
    );
    expect(NAKAFA_MCP_EDGE_CONTRACT.originEnvironment).toBe(
      NAKAFA_API_EDGE_CONTRACT.originEnvironment
    );
  });

  it.each([
    ["/openapi.json", "/openapi.json"],
    ["/v1", "/v1"],
    ["/v1/content", "/v1/content"],
  ])("projects the protected origin path for %s", (path, expected) => {
    expect(
      projectPublicApiPath(`${NAKAFA_API_EDGE_CONTRACT.originPath}${path}`)
    ).toBe(expected);
  });
});
