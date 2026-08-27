import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { withMcpOriginGuard } from "@/lib/mcp/origin";

describe("MCP Origin helpers", () => {
  it.effect("allows owned, local, and configured Origins", () =>
    Effect.gen(function* () {
      const defaultGuard = withMcpOriginGuard(() =>
        Promise.resolve(new Response("ok", { status: 200 }))
      );
      const customGuard = withMcpOriginGuard(
        () => Promise.resolve(new Response("ok", { status: 200 })),
        "not a url, https://agent.example.com:443/"
      );
      const requests = [
        defaultGuard(
          new Request("https://mcp.nakafa.com/mcp", {
            headers: { origin: "https://nakafa.com" },
          })
        ),
        defaultGuard(
          new Request("https://mcp.nakafa.com/mcp", {
            headers: { origin: "https://api.nakafa.com" },
          })
        ),
        defaultGuard(
          new Request("https://mcp.nakafa.com/mcp", {
            headers: { origin: "https://docs.nakafa.com" },
          })
        ),
        defaultGuard(
          new Request("https://mcp.nakafa.com/mcp", {
            headers: { origin: "http://localhost:3002" },
          })
        ),
        customGuard(
          new Request("https://mcp.nakafa.com/mcp", {
            headers: { origin: "https://agent.example.com" },
          })
        ),
      ];
      const responses = yield* Effect.all(
        requests.map((request) => Effect.promise(() => request))
      );

      expect(responses.map((response) => response.status)).toEqual([
        200, 200, 200, 200, 200,
      ]);
      expect(
        responses.map((response) =>
          response.headers.get("access-control-allow-origin")
        )
      ).toEqual([
        "https://nakafa.com",
        "https://api.nakafa.com",
        "https://docs.nakafa.com",
        "http://localhost:3002",
        "https://agent.example.com",
      ]);
    })
  );

  it.effect("rejects invalid, untrusted, and insecure Origins", () =>
    Effect.gen(function* () {
      const guarded = withMcpOriginGuard(() =>
        Promise.resolve(new Response("ok", { status: 200 }))
      );
      const responses = yield* Effect.all(
        ["not a url", "https://evil.example.com", "http://api.nakafa.com"].map(
          (origin) =>
            Effect.promise(() =>
              guarded(
                new Request("https://mcp.nakafa.com/mcp", {
                  headers: { origin },
                })
              )
            )
        )
      );

      for (const response of responses) {
        expect(response.status).toBe(403);
        expect(response.headers.get("content-type")).toBe(
          "text/plain; charset=utf-8"
        );
        const text = yield* Effect.promise(() => response.text());
        expect(text).toBe("Forbidden MCP Origin");
      }
    })
  );

  it.effect(
    "keeps server-client requests without Origin free of browser CORS headers",
    () =>
      Effect.gen(function* () {
        const guarded = withMcpOriginGuard(() =>
          Promise.resolve(new Response("ok", { status: 200 }))
        );
        const response = yield* Effect.promise(() =>
          guarded(new Request("https://mcp.nakafa.com/mcp"))
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("access-control-allow-origin")).toBeNull();
        const text = yield* Effect.promise(() => response.text());
        expect(text).toBe("ok");
      })
  );

  it.effect("echoes only supported MCP CORS request headers", () =>
    Effect.gen(function* () {
      const guarded = withMcpOriginGuard(() =>
        Promise.resolve(new Response("ok", { status: 200 }))
      );
      const response = yield* Effect.promise(() =>
        guarded(
          new Request("https://mcp.nakafa.com/mcp", {
            headers: {
              "access-control-request-headers": [
                "content-type",
                "last-event-id",
                "mcp-method",
                "mcp-name",
                "mcp-param-region",
                "mcp-protocol-version",
                "mcp-session-id",
                "x-unsupported",
              ].join(","),
              origin: "https://nakafa.com",
            },
            method: "OPTIONS",
          })
        )
      );
      const allowHeaders = response.headers.get("access-control-allow-headers");

      expect(response.status).toBe(204);
      expect(allowHeaders).toContain("mcp-method");
      expect(allowHeaders).toContain("mcp-name");
      expect(allowHeaders).toContain("mcp-param-region");
      expect(allowHeaders).toContain("last-event-id");
      expect(allowHeaders).not.toContain("x-unsupported");
      expect(response.headers.get("access-control-expose-headers")).toBe(
        "mcp-protocol-version,mcp-session-id"
      );
      expect(response.headers.get("vary")).toBe(
        "Origin, Access-Control-Request-Headers"
      );
    })
  );
});
