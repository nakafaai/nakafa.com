// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import {
  NAKAFA_API_EDGE_CONTRACT,
  NAKAFA_MCP_EDGE_CONTRACT,
} from "@repo/backend/agent/edge";
import { agentEdgeWorker, forwardAgentEdge } from "@repo/backend/agent/proxy";
import {
  NAKAFA_API_EDGE_PATHS,
  NAKAFA_MCP_EDGE_PATHS,
} from "@repo/backend/agent/route";
import { FetchClient } from "@repo/utilities/http/client";
import { Effect } from "effect";
import { FetchHttpClient } from "effect/http";

const fetcher = vi.fn<typeof fetch>();

beforeEach(() => {
  fetcher.mockReset();
  vi.stubGlobal("fetch", fetcher);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const bindings = {
  NAKAFA_API_EDGE_SECRET: "edge-secret",
  CONVEX_SITE_URL: "https://origin.convex.site",
  NAKAFA_RELEASE_SHA: "abc123",
};

describe("forwardAgentEdge", () => {
  it.effect(
    "sends a runtime request to the protected origin with the edge secret",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValue(
          new Response('{"ok":true}', {
            headers: { "content-type": "application/json" },
            status: 201,
          })
        );
        const request = new Request(
          "https://api.nakafa.com/v1/search?q=ratio",
          {
            body: '{"query":"ratio"}',
            headers: { authorization: "Bearer caller", cookie: "session=1" },
            method: "POST",
          }
        );

        const response = yield* forwardAgentEdge(
          NAKAFA_API_EDGE_CONTRACT,
          NAKAFA_API_EDGE_PATHS,
          request,
          bindings
        ).pipe(
          Effect.provide(FetchClient),
          Effect.provideService(FetchHttpClient.Fetch, fetcher)
        );

        const [target, init] = fetcher.mock.calls[0] ?? [];
        const sent = new Headers(init?.headers);
        expect(String(target)).toBe(
          "https://origin.convex.site/internal/agent/runtime/search?q=ratio"
        );
        expect(init?.method).toBe("POST");
        expect(init?.redirect).toBe("manual");
        expect(sent.get("authorization")).toBeNull();
        expect(sent.get("cookie")).toBeNull();
        expect(sent.get("x-nakafa-api-edge-secret")).toBe("edge-secret");
        expect(response.status).toBe(201);
        expect(response.headers.get("x-nakafa-release-sha")).toBe("abc123");
        expect(yield* Effect.promise(() => response.text())).toBe(
          '{"ok":true}'
        );
      })
  );

  it.effect("maps the discovery document to the origin document path", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValue(new Response("{}"));
      const request = new Request("https://api.nakafa.com/openapi.json");

      yield* forwardAgentEdge(
        NAKAFA_API_EDGE_CONTRACT,
        NAKAFA_API_EDGE_PATHS,
        request,
        bindings
      ).pipe(
        Effect.provide(FetchClient),
        Effect.provideService(FetchHttpClient.Fetch, fetcher)
      );

      expect(String(fetcher.mock.calls[0]?.[0])).toBe(
        "https://origin.convex.site/internal/agent/openapi"
      );
    })
  );

  it.effect("forwards the MCP transport to its own origin path", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValue(new Response("ok"));
      const request = new Request("https://mcp.nakafa.com/mcp");

      yield* forwardAgentEdge(
        NAKAFA_MCP_EDGE_CONTRACT,
        NAKAFA_MCP_EDGE_PATHS,
        request,
        {
          CONVEX_SITE_URL: "https://origin.convex.site",
          NAKAFA_MCP_EDGE_SECRET: "mcp-secret",
          NAKAFA_RELEASE_SHA: "abc123",
        }
      ).pipe(
        Effect.provide(FetchClient),
        Effect.provideService(FetchHttpClient.Fetch, fetcher)
      );

      expect(String(fetcher.mock.calls[0]?.[0])).toBe(
        "https://origin.convex.site/internal/mcp"
      );
    })
  );

  it.effect(
    "answers 404 for an undeclared path without calling the origin",
    () =>
      Effect.gen(function* () {
        const request = new Request("https://api.nakafa.com/health");

        const response = yield* forwardAgentEdge(
          NAKAFA_API_EDGE_CONTRACT,
          NAKAFA_API_EDGE_PATHS,
          request,
          bindings
        ).pipe(
          Effect.provide(FetchClient),
          Effect.provideService(FetchHttpClient.Fetch, fetcher)
        );

        expect(response.status).toBe(404);
        expect(fetcher).not.toHaveBeenCalled();
      })
  );

  it.effect("answers 405 for a method that HTTP does not define", () =>
    Effect.gen(function* () {
      const request = new Request("https://api.nakafa.com/v1", {
        method: "FOO",
      });

      const response = yield* forwardAgentEdge(
        NAKAFA_API_EDGE_CONTRACT,
        NAKAFA_API_EDGE_PATHS,
        request,
        bindings
      ).pipe(
        Effect.provide(FetchClient),
        Effect.provideService(FetchHttpClient.Fetch, fetcher)
      );

      expect(response.status).toBe(405);
      expect(fetcher).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "fails with the missing binding's name when the secret is empty",
    () =>
      Effect.gen(function* () {
        const request = new Request("https://api.nakafa.com/v1");

        const error = yield* Effect.flip(
          forwardAgentEdge(
            NAKAFA_API_EDGE_CONTRACT,
            NAKAFA_API_EDGE_PATHS,
            request,
            {
              ...bindings,
              NAKAFA_API_EDGE_SECRET: "",
            }
          ).pipe(
            Effect.provide(FetchClient),
            Effect.provideService(FetchHttpClient.Fetch, fetcher)
          )
        );

        expect(error).toMatchObject({
          _tag: "AgentEdgeBindingError",
          binding: "NAKAFA_API_EDGE_SECRET",
        });
        expect(fetcher).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "fails with an upstream error when the origin cannot be reached",
    () =>
      Effect.gen(function* () {
        fetcher.mockRejectedValue(new TypeError("connection reset"));
        const request = new Request("https://api.nakafa.com/v1");

        const error = yield* Effect.flip(
          forwardAgentEdge(
            NAKAFA_API_EDGE_CONTRACT,
            NAKAFA_API_EDGE_PATHS,
            request,
            bindings
          ).pipe(
            Effect.provide(FetchClient),
            Effect.provideService(FetchHttpClient.Fetch, fetcher)
          )
        );

        expect(error).toMatchObject({ _tag: "AgentEdgeUpstreamError" });
      })
  );

  it.effect(
    "sets the client address from Cloudflare and drops the caller's forwarded address",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValue(new Response("{}"));
        const request = new Request("https://api.nakafa.com/v1", {
          headers: {
            "cf-connecting-ip": "203.0.113.9",
            "x-forwarded-for": "198.51.100.1",
          },
        });

        yield* forwardAgentEdge(
          NAKAFA_API_EDGE_CONTRACT,
          NAKAFA_API_EDGE_PATHS,
          request,
          bindings
        ).pipe(
          Effect.provide(FetchClient),
          Effect.provideService(FetchHttpClient.Fetch, fetcher)
        );

        const sent = new Headers(fetcher.mock.calls[0]?.[1]?.headers);
        expect(sent.get("x-forwarded-for")).toBe("203.0.113.9");
      })
  );

  it.effect("sends no client address when Cloudflare sent none", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValue(new Response("{}"));
      const request = new Request("https://api.nakafa.com/v1", {
        headers: { "x-forwarded-for": "198.51.100.1" },
      });

      yield* forwardAgentEdge(
        NAKAFA_API_EDGE_CONTRACT,
        NAKAFA_API_EDGE_PATHS,
        request,
        bindings
      ).pipe(
        Effect.provide(FetchClient),
        Effect.provideService(FetchHttpClient.Fetch, fetcher)
      );

      const sent = new Headers(fetcher.mock.calls[0]?.[1]?.headers);
      expect(sent.get("x-forwarded-for")).toBeNull();
    })
  );

  it.effect("passes the origin's cache policy through to the caller", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValue(
        new Response("{}", {
          headers: { "cache-control": "public, max-age=300" },
        })
      );

      const response = yield* forwardAgentEdge(
        NAKAFA_API_EDGE_CONTRACT,
        NAKAFA_API_EDGE_PATHS,
        new Request("https://api.nakafa.com/openapi.json"),
        bindings
      ).pipe(
        Effect.provide(FetchClient),
        Effect.provideService(FetchHttpClient.Fetch, fetcher)
      );

      expect(response.headers.get("cache-control")).toBe("public, max-age=300");
    })
  );
});

describe("agentEdgeWorker", () => {
  it("answers the Worker fetch with the forwarded response", async () => {
    fetcher.mockResolvedValue(new Response("pong"));
    const worker = agentEdgeWorker(
      NAKAFA_API_EDGE_CONTRACT,
      NAKAFA_API_EDGE_PATHS
    );

    const response = await worker.fetch(
      new Request("https://api.nakafa.com/v1"),
      bindings
    );

    expect(await response.text()).toBe("pong");
  });

  it("answers 500 without naming the binding when the Worker is not configured", async () => {
    const worker = agentEdgeWorker(
      NAKAFA_API_EDGE_CONTRACT,
      NAKAFA_API_EDGE_PATHS
    );

    const response = await worker.fetch(
      new Request("https://api.nakafa.com/v1"),
      { ...bindings, CONVEX_SITE_URL: undefined }
    );

    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("CONVEX_SITE_URL");
  });

  it("answers 502 when the origin cannot be reached", async () => {
    fetcher.mockRejectedValue(new TypeError("connection reset"));
    const worker = agentEdgeWorker(
      NAKAFA_API_EDGE_CONTRACT,
      NAKAFA_API_EDGE_PATHS
    );

    const response = await worker.fetch(
      new Request("https://api.nakafa.com/v1"),
      bindings
    );

    expect(response.status).toBe(502);
  });
});
