import {
  NAKAFA_API_EDGE_CONTRACT,
  NAKAFA_EDGE_RELEASE_SHA_HEADER,
  NAKAFA_MCP_EDGE_CONTRACT,
  projectPublicApiPath,
  VERCEL_GIT_COMMIT_SHA_ENVIRONMENT,
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

  it("owns the public deployment identity contract", () => {
    expect(NAKAFA_EDGE_RELEASE_SHA_HEADER).toBe("x-nakafa-release-sha");
    expect(VERCEL_GIT_COMMIT_SHA_ENVIRONMENT).toBe("VERCEL_GIT_COMMIT_SHA");
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
