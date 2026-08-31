import { describe, expect, it } from "@effect/vitest";
import {
  NAKAFA_API_EDGE_CONTRACT,
  NAKAFA_EDGE_RELEASE_SHA_HEADER,
  NAKAFA_MCP_EDGE_CONTRACT,
  projectPublicApiPath,
  VERCEL_GIT_COMMIT_SHA_ENVIRONMENT,
} from "@repo/backend/agent/edge";
import { NAKAFA_PUBLIC_API_PATH } from "@repo/contents/_lib/agent/constants";

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

  it("separates the protected document and runtime capabilities", () => {
    expect(NAKAFA_API_EDGE_CONTRACT.documentPath).toBe("/openapi");
    expect(NAKAFA_API_EDGE_CONTRACT.publicPath).toBe(NAKAFA_PUBLIC_API_PATH);
    expect(NAKAFA_API_EDGE_CONTRACT.runtimePath).toBe("/runtime");
  });

  it.each([
    ["", "/"],
    ["/openapi.json", "/openapi.json"],
    ["/runtime", "/v1"],
    ["/runtime/content", "/v1/content"],
    ["/v1", "/v1"],
    ["/v1/content", "/v1/content"],
    ["/content", "/content"],
  ])("projects the protected origin path for %s", (path, expected) => {
    expect(
      projectPublicApiPath(`${NAKAFA_API_EDGE_CONTRACT.originPath}${path}`)
    ).toBe(expected);
  });
});
