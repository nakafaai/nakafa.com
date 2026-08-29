import { describe, expect, it } from "@effect/vitest";
import {
  NAKAFA_API_EDGE_CONTRACT,
  NAKAFA_EDGE_RELEASE_SHA_HEADER,
  NAKAFA_MCP_EDGE_CONTRACT,
  VERCEL_GIT_COMMIT_SHA_ENVIRONMENT,
} from "@repo/backend/agent/edge";
import { createAgentEdgeRoute } from "@repo/backend/agent/route";

describe("agent Vercel route", () => {
  it.each([
    {
      contract: NAKAFA_API_EDGE_CONTRACT,
      destination: "$NAKAFA_CONVEX_SITE_URL/internal/agent/$1",
      source: "^/(openapi\\.json|v1(?:/.*)?)$",
      suffix: "/$1",
    },
    {
      contract: NAKAFA_MCP_EDGE_CONTRACT,
      destination: "$NAKAFA_CONVEX_SITE_URL/internal/mcp",
      source: "^/mcp$",
      suffix: "",
    },
  ])("protects $source before rewriting to Convex", (input) => {
    expect(
      createAgentEdgeRoute({
        contract: input.contract,
        source: input.source,
        suffix: input.suffix,
      })
    ).toEqual({
      routes: [
        {
          src: input.source,
          dest: input.destination,
          env: [input.contract.originEnvironment],
          respectOriginCacheControl: false,
          transforms: [
            {
              type: "request.headers",
              op: "delete",
              target: { key: "authorization" },
            },
            {
              type: "request.headers",
              op: "delete",
              target: { key: "cookie" },
            },
            {
              type: "request.headers",
              op: "delete",
              target: { key: input.contract.secretHeader },
            },
            {
              type: "request.headers",
              op: "set",
              target: { key: input.contract.secretHeader },
              args: `$${input.contract.secretEnvironment}`,
              env: [input.contract.secretEnvironment],
            },
            {
              type: "response.headers",
              op: "set",
              target: { key: NAKAFA_EDGE_RELEASE_SHA_HEADER },
              args: `$${VERCEL_GIT_COMMIT_SHA_ENVIRONMENT}`,
              env: [VERCEL_GIT_COMMIT_SHA_ENVIRONMENT],
            },
          ],
        },
      ],
    });
  });
});
