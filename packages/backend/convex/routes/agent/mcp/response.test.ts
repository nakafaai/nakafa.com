// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  mcpErrorResponse,
  mcpOptionsResponse,
  mcpParsedErrorResponse,
  mcpTransportErrorResponse,
  readJsonRpcRequestId,
  withMcpResponseHeaders,
} from "@repo/backend/convex/routes/agent/mcp/response";
import { Effect } from "effect";

const REQUEST_ID = "request-1";

const json = (response: Response) => Effect.promise(() => response.json());
const text = (response: Response) => Effect.promise(() => response.text());

describe("MCP response boundary", () => {
  it.effect("writes one no-store JSON-RPC error with the request id", () =>
    Effect.gen(function* () {
      const response = mcpErrorResponse(400, -32_600, "Invalid", REQUEST_ID);

      expect(response.status).toBe(400);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(response.headers.get("Content-Type")).toBe(
        "application/json; charset=utf-8"
      );
      expect(response.headers.get("Retry-After")).toBeNull();
      expect(yield* json(response)).toStrictEqual({
        error: {
          code: -32_600,
          data: { request_id: REQUEST_ID },
          message: "Invalid",
        },
        id: null,
        jsonrpc: "2.0",
      });
    })
  );

  it.effect("rounds a bounded retry delay up to whole seconds", () =>
    Effect.gen(function* () {
      const response = mcpErrorResponse(
        429,
        -32_000,
        "Rate limited",
        REQUEST_ID,
        "call-1",
        2500
      );

      expect(response.headers.get("Retry-After")).toBe("3");
      expect(yield* json(response)).toStrictEqual({
        error: {
          code: -32_000,
          data: { request_id: REQUEST_ID, retry_after_ms: 2500 },
          message: "Rate limited",
        },
        id: "call-1",
        jsonrpc: "2.0",
      });
    })
  );

  it.effect("rejects a transport request without a JSON-RPC body", () =>
    Effect.gen(function* () {
      const delayed = mcpTransportErrorResponse(503, 0);
      const plain = mcpTransportErrorResponse(500);

      expect(delayed.status).toBe(503);
      expect(delayed.headers.get("Cache-Control")).toBe("no-store");
      expect(delayed.headers.get("Retry-After")).toBe("1");
      expect(delayed.body).toBeNull();
      expect(yield* text(delayed)).toBe("");
      expect(plain.headers.get("Retry-After")).toBeNull();
    })
  );

  it.effect("keeps notification semantics for an unprocessed request", () =>
    Effect.gen(function* () {
      const response = mcpParsedErrorResponse(
        { id: 7, jsonrpc: "2.0", method: "ping" },
        400,
        -32_600,
        "Invalid",
        REQUEST_ID
      );
      const notification = mcpParsedErrorResponse(
        { jsonrpc: "2.0", method: "ping" },
        503,
        -32_000,
        "Unavailable",
        REQUEST_ID
      );

      expect((yield* json(response)).id).toBe(7);
      expect(notification.body).toBeNull();
      expect(notification.status).toBe(503);
    })
  );

  it.effect("classifies every body that is not a notification", () =>
    Effect.sync(() => {
      const bodies = [
        null,
        [],
        {},
        { jsonrpc: "1.0" },
        { jsonrpc: "2.0" },
        { jsonrpc: "2.0", method: 5 },
      ];

      for (const body of bodies) {
        const response = mcpParsedErrorResponse(
          body,
          400,
          -32_600,
          "Invalid",
          REQUEST_ID
        );
        expect(response.body).not.toBeNull();
      }
    })
  );

  it.effect("recovers only an echoable JSON-RPC request id", () =>
    Effect.sync(() => {
      expect(readJsonRpcRequestId(null)).toBeNull();
      expect(readJsonRpcRequestId([])).toBeNull();
      expect(readJsonRpcRequestId({ jsonrpc: "2.0" })).toBeNull();
      expect(readJsonRpcRequestId({ id: true })).toBeNull();
      expect(readJsonRpcRequestId({ id: 12 })).toBe(12);
      expect(readJsonRpcRequestId({ id: "abc" })).toBe("abc");
    })
  );

  it.effect("defaults CORS to any origin without credentials", () =>
    Effect.sync(() => {
      const response = mcpOptionsResponse(
        new Request("https://mcp.nakafa.com/mcp")
      );

      expect(response.status).toBe(204);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(
        response.headers.get("Access-Control-Allow-Credentials")
      ).toBeNull();
      expect(response.headers.get("Access-Control-Allow-Headers")).toContain(
        "content-type"
      );
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    })
  );

  it.effect("reflects the caller origin and filters requested headers", () =>
    Effect.gen(function* () {
      const request = new Request("https://mcp.nakafa.com/mcp", {
        headers: {
          "access-control-request-headers":
            "Content-Type, X-Unknown, MCP-Param-Topic",
          origin: "https://www.nakafa.com",
        },
      });
      const response = withMcpResponseHeaders(
        new Response("ok", { status: 200 }),
        request
      );

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://www.nakafa.com"
      );
      expect(response.headers.get("Access-Control-Allow-Credentials")).toBe(
        "true"
      );
      expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
        "content-type,mcp-param-topic"
      );
      expect(response.headers.get("Vary")).toBe(
        "Origin, Access-Control-Request-Headers"
      );
      expect(yield* text(response)).toBe("ok");
    })
  );
});
