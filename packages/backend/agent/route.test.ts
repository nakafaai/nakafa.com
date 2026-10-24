import { describe, expect, it } from "@effect/vitest";
import {
  NAKAFA_API_EDGE_CONTRACT,
  NAKAFA_MCP_EDGE_CONTRACT,
} from "@repo/backend/agent/edge";
import {
  agentEdgeOriginPath,
  agentEdgeRequestHeaders,
  NAKAFA_API_EDGE_PATHS,
  NAKAFA_MCP_EDGE_PATHS,
} from "@repo/backend/agent/route";
import { Array as Arr } from "effect";

describe("agentEdgeOriginPath", () => {
  it.each([
    ["/openapi.json", "/internal/agent/openapi"],
    ["/v1", "/internal/agent/runtime"],
    ["/v1/content", "/internal/agent/runtime/content"],
    ["/v1/quran/1", "/internal/agent/runtime/quran/1"],
  ])(
    "rewrites the public %s to the protected origin path %s",
    (path, origin) => {
      expect(
        agentEdgeOriginPath(
          NAKAFA_API_EDGE_CONTRACT,
          NAKAFA_API_EDGE_PATHS,
          path
        )
      ).toBe(origin);
    }
  );

  it("maps the MCP endpoint to its protected transport", () => {
    expect(
      agentEdgeOriginPath(
        NAKAFA_MCP_EDGE_CONTRACT,
        NAKAFA_MCP_EDGE_PATHS,
        "/mcp"
      )
    ).toBe("/internal/mcp");
  });

  it.each(["/", "/health", "/robots.txt", "/v2"])(
    "owns no origin path for the undeclared %s",
    (path) => {
      expect(
        agentEdgeOriginPath(
          NAKAFA_API_EDGE_CONTRACT,
          NAKAFA_API_EDGE_PATHS,
          path
        )
      ).toBeUndefined();
    }
  );

  it("keeps the discovery document off the runtime path", () => {
    expect(
      agentEdgeOriginPath(
        NAKAFA_API_EDGE_CONTRACT,
        NAKAFA_API_EDGE_PATHS,
        "/v1/openapi.json"
      )
    ).toBe("/internal/agent/runtime/openapi.json");
  });

  it("declares every API path that the public contract serves", () => {
    expect(
      Arr.every(
        ["/openapi.json", "/v1", "/v1/search", "/v1/taxonomy"],
        (path) =>
          agentEdgeOriginPath(
            NAKAFA_API_EDGE_CONTRACT,
            NAKAFA_API_EDGE_PATHS,
            path
          ) !== undefined
      )
    ).toBe(true);
  });
});

describe("agentEdgeRequestHeaders", () => {
  it("removes browser credentials and replaces the edge secret", () => {
    const headers = agentEdgeRequestHeaders(
      new Headers({
        accept: "application/json",
        authorization: "Bearer caller",
        cookie: "session=caller",
        "x-nakafa-api-edge-secret": "caller-secret",
      }),
      NAKAFA_API_EDGE_CONTRACT,
      "edge-secret"
    );

    expect(headers.get("authorization")).toBeNull();
    expect(headers.get("cookie")).toBeNull();
    expect(headers.get("x-nakafa-api-edge-secret")).toBe("edge-secret");
    expect(headers.get("accept")).toBe("application/json");
  });

  it("takes the client address from Cloudflare and drops the caller's host and forwarded address", () => {
    const headers = agentEdgeRequestHeaders(
      new Headers({
        host: "caller.example",
        "cf-connecting-ip": "203.0.113.9",
        "x-forwarded-for": "198.51.100.1",
      }),
      NAKAFA_API_EDGE_CONTRACT,
      "edge-secret"
    );

    expect(headers.get("host")).toBeNull();
    expect(headers.get("x-forwarded-for")).toBe("203.0.113.9");
  });

  it("leaves the origin no client address when Cloudflare sent none", () => {
    const headers = agentEdgeRequestHeaders(
      new Headers({ "x-forwarded-for": "198.51.100.1" }),
      NAKAFA_API_EDGE_CONTRACT,
      "edge-secret"
    );

    expect(headers.get("x-forwarded-for")).toBeNull();
  });
});
