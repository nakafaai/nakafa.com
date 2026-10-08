// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { withDiscoveryCapabilities } from "@repo/backend/confect/routes/agent/mcp/discovery";
import { Effect } from "effect";

const DISCOVER_REQUEST = { method: "server/discover" };
const TOOLS_LIST_REQUEST = { method: "tools/list" };

/** A JSON answer with its own content length, as the engine writes it. */
function jsonAnswer(text: string) {
  return new Response(text, {
    headers: {
      "content-length": String(new TextEncoder().encode(text).byteLength),
      "content-type": "application/json",
    },
    status: 200,
    statusText: "OK",
  });
}

describe("Nakafa MCP discovery capabilities", () => {
  it.effect(
    "replaces only the capabilities of a successful discovery answer",
    () =>
      Effect.gen(function* () {
        const answer = jsonAnswer(
          '{"jsonrpc":"2.0","id":1,"result":{"_meta":{"x":1},"capabilities":{"tools":{"listChanged":true}},"instructions":"Use Nakafa.","supportedVersions":["2026-07-28"],"ttlMs":0}}'
        );
        const declared = yield* withDiscoveryCapabilities(
          DISCOVER_REQUEST,
          answer
        );

        expect(declared.status).toBe(200);
        expect(declared.statusText).toBe("OK");
        expect(declared.headers.get("content-type")).toBe("application/json");
        expect(declared.headers.has("content-length")).toBe(false);
        expect(yield* Effect.promise(() => declared.text())).toBe(
          '{"jsonrpc":"2.0","id":1,"result":{"_meta":{"x":1},"capabilities":{"prompts":{},"resources":{},"tools":{}},"instructions":"Use Nakafa.","supportedVersions":["2026-07-28"],"ttlMs":0}}'
        );
      })
  );

  it.effect(
    "returns a discovery answer with an error as the same response",
    () =>
      Effect.gen(function* () {
        const answer = jsonAnswer(
          '{"jsonrpc":"2.0","id":30,"error":{"code":-32022,"message":"Unsupported protocol version"}}'
        );
        expect(yield* withDiscoveryCapabilities(DISCOVER_REQUEST, answer)).toBe(
          answer
        );
      })
  );

  it.effect(
    "returns a discovery answer without capabilities as the same response",
    () =>
      Effect.gen(function* () {
        const answer = jsonAnswer('{"jsonrpc":"2.0","id":1,"result":{}}');
        expect(yield* withDiscoveryCapabilities(DISCOVER_REQUEST, answer)).toBe(
          answer
        );
      })
  );

  it.effect("returns the answer of any other method as the same response", () =>
    Effect.gen(function* () {
      const answer = jsonAnswer(
        '{"jsonrpc":"2.0","id":2,"result":{"capabilities":{"tools":{}},"tools":[]}}'
      );
      expect(yield* withDiscoveryCapabilities(TOOLS_LIST_REQUEST, answer)).toBe(
        answer
      );
    })
  );

  it.effect("returns a body that does not decode as the same response", () =>
    Effect.gen(function* () {
      const answer = jsonAnswer("not a JSON document");
      expect(yield* withDiscoveryCapabilities(DISCOVER_REQUEST, answer)).toBe(
        answer
      );
    })
  );
});
