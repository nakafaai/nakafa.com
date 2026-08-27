import {
  AgentEdgeReleaseShaSchema,
  NAKAFA_API_EDGE_CONTRACT,
  NAKAFA_EDGE_RELEASE_SHA_HEADER,
  NAKAFA_MCP_EDGE_CONTRACT,
  projectPublicApiPath,
  setAgentEdgeReleaseHeader,
  VERCEL_GIT_COMMIT_SHA_ENVIRONMENT,
} from "@repo/backend/agent/edge";
import { Schema } from "effect";
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
    expect(Schema.is(AgentEdgeReleaseShaSchema)("a".repeat(40))).toBe(true);
    expect(Schema.is(AgentEdgeReleaseShaSchema)("A".repeat(40))).toBe(false);
    expect(Schema.is(AgentEdgeReleaseShaSchema)("a".repeat(39))).toBe(false);
  });

  it("attaches only available deployment identity", () => {
    const headers = new Headers();

    setAgentEdgeReleaseHeader(headers, undefined);
    expect(headers.get(NAKAFA_EDGE_RELEASE_SHA_HEADER)).toBeNull();

    setAgentEdgeReleaseHeader(headers, "a".repeat(40));
    expect(headers.get(NAKAFA_EDGE_RELEASE_SHA_HEADER)).toBe("a".repeat(40));
  });

  it.each([
    ["", "/"],
    ["/openapi.json", "/openapi.json"],
    ["/v1", "/v1"],
    ["/v1/content", "/v1/content"],
  ])("projects the protected origin path for %s", (path, expected) => {
    expect(
      projectPublicApiPath(`${NAKAFA_API_EDGE_CONTRACT.originPath}${path}`)
    ).toBe(expected);
  });
});
