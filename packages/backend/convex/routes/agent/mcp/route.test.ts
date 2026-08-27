// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import {
  CLIENT_CAPABILITIES_META_KEY,
  CLIENT_INFO_META_KEY,
  LATEST_PROTOCOL_VERSION as MCP_PREDECESSOR_PROTOCOL_VERSION,
  PROTOCOL_VERSION_META_KEY,
} from "@modelcontextprotocol/server";
import { NAKAFA_MCP_EDGE_CONTRACT } from "@repo/backend/agent/edge";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { NAKAFA_MCP_PROTOCOL_VERSION } from "@repo/contents/_lib/agent/constants";
import { Effect } from "effect";
import { vi } from "vitest";

const MCP_SECRET = "technical-mcp-edge-secret";
const MCP_PATH = NAKAFA_MCP_EDGE_CONTRACT.originPath;
const MCP_SECRET_ENVIRONMENT = NAKAFA_MCP_EDGE_CONTRACT.secretEnvironment;
const MODERN_META = {
  [CLIENT_CAPABILITIES_META_KEY]: {},
  [CLIENT_INFO_META_KEY]: { name: "nakafa-test-client", version: "1.0.0" },
  [PROTOCOL_VERSION_META_KEY]: NAKAFA_MCP_PROTOCOL_VERSION,
};
type BackendTest = ReturnType<typeof createConvexTestWithBetterAuth>;
const json = (response: Response) => Effect.promise(() => response.json());
const text = (response: Response) => Effect.promise(() => response.text());
function fetchMcp(test: BackendTest, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set(NAKAFA_MCP_EDGE_CONTRACT.secretHeader, MCP_SECRET);
  const forwardedFor = headers.get("x-forwarded-for") ?? "203.0.113.21";
  headers.set("x-forwarded-for", forwardedFor);
  const request = { ...init, headers };
  return Effect.promise(() => test.fetch(MCP_PATH, request));
}
function postModern(
  test: BackendTest,
  id: number,
  method: string,
  params: Readonly<Record<string, unknown>> = {},
  name?: string
) {
  const headers = new Headers({
    accept: "application/json, text/event-stream",
    "content-type": "application/json",
    "mcp-method": method,
    "mcp-protocol-version": NAKAFA_MCP_PROTOCOL_VERSION,
  });
  if (name !== undefined) {
    headers.set("mcp-name", name);
  }
  return fetchMcp(test, {
    body: JSON.stringify({
      id,
      jsonrpc: "2.0",
      method,
      params: { ...params, _meta: MODERN_META },
    }),
    headers,
    method: "POST",
  });
}
beforeEach(() => vi.stubEnv(MCP_SECRET_ENVIRONMENT, MCP_SECRET));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
describe("Nakafa MCP transport", () => {
  it.effect("serves current discovery and the established tool surface", () =>
    Effect.gen(function* () {
      const test = createConvexTestWithBetterAuth();
      const discover = yield* postModern(test, 1, "server/discover");
      const discoverBody = yield* json(discover);
      const tools = yield* postModern(test, 2, "tools/list");
      const toolsBody = yield* json(tools);
      expect(discover.status, JSON.stringify(discoverBody)).toBe(200);
      expect(discoverBody).toMatchObject({
        id: 1,
        result: {
          _meta: {
            "io.modelcontextprotocol/serverInfo": {
              name: "nakafa-mcp-server",
              version: "1.0.1",
            },
          },
        },
      });
      expect(tools.status, JSON.stringify(toolsBody)).toBe(200);
      expect(toolsBody).toMatchObject({
        result: {
          tools: [
            { name: "nakafa_search_content" },
            { name: "nakafa_get_content" },
            { name: "nakafa_get_taxonomy" },
            { name: "nakafa_get_quran_reference" },
          ],
        },
      });
    })
  );
  it.effect("preserves static resources, templates, and prompts", () =>
    Effect.gen(function* () {
      const test = createConvexTestWithBetterAuth();
      const usageUri = "nakafa://usage";
      const responses = yield* Effect.all([
        postModern(test, 10, "resources/list"),
        postModern(test, 11, "resources/templates/list"),
        postModern(test, 12, "resources/read", { uri: usageUri }, usageUri),
        postModern(test, 13, "prompts/list"),
        postModern(
          test,
          14,
          "prompts/get",
          {
            arguments: { topic: "linear equations" },
            name: "nakafa_find_lesson",
          },
          "nakafa_find_lesson"
        ),
      ]);
      const bodies = yield* Effect.all(responses.map(json));
      expect(responses.every(({ status }) => status === 200)).toBe(true);
      expect(bodies[0]).toMatchObject({
        result: {
          resources: [{ uri: "nakafa://usage" }, { uri: "nakafa://taxonomy" }],
        },
      });
      expect(bodies[1]).toMatchObject({
        result: {
          resourceTemplates: [{ uriTemplate: "nakafa://content/{contentId}" }],
        },
      });
      expect(bodies[2]).toMatchObject({
        result: {
          contents: [
            {
              mimeType: "text/markdown",
              text: expect.stringContaining("# Nakafa MCP Usage"),
              uri: usageUri,
            },
          ],
        },
      });
      expect(bodies[3]).toMatchObject({
        result: {
          prompts: [
            { name: "nakafa_find_lesson" },
            { name: "nakafa_answer_from_content" },
            { name: "nakafa_quran_reference" },
          ],
        },
      });
      expect(bodies[4]).toMatchObject({
        result: {
          messages: [
            {
              content: { text: expect.stringContaining("linear equations") },
            },
          ],
        },
      });
    })
  );
  it.effect(
    "renders every workflow prompt through strict argument contracts",
    () =>
      Effect.gen(function* () {
        const test = createConvexTestWithBetterAuth();
        const responses = yield* Effect.all([
          postModern(
            test,
            15,
            "prompts/get",
            {
              arguments: {
                content_ref: "https://nakafa.com/en/articles/math/algebra",
                question: "What is the key idea?",
              },
              name: "nakafa_answer_from_content",
            },
            "nakafa_answer_from_content"
          ),
          postModern(
            test,
            16,
            "prompts/get",
            {
              arguments: {
                from_verse: "1",
                locale: "id",
                question: "Apa pesan ayat ini?",
                surah: "1",
                to_verse: "7",
              },
              name: "nakafa_quran_reference",
            },
            "nakafa_quran_reference"
          ),
          postModern(
            test,
            17,
            "prompts/get",
            {
              arguments: { topic: "" },
              name: "nakafa_find_lesson",
            },
            "nakafa_find_lesson"
          ),
        ]);
        const bodies = yield* Effect.all(responses.map(json));
        expect(responses.map(({ status }) => status)).toEqual([200, 200, 200]);
        expect(bodies[0].result.messages[0].content.text).toContain(
          "What is the key idea?"
        );
        expect(bodies[1].result.messages[0].content.text).toContain(
          "Surah 1, verses 1-7"
        );
        expect(bodies[2]).toMatchObject({ error: { code: -32_602 }, id: 17 });
        expect(bodies[2].jsonrpc).toBe("2.0");
      })
  );
  it.effect("returns typed resource failures without inventing content", () =>
    Effect.gen(function* () {
      const missingUri = "nakafa://content/asset:en:article:missing";
      const response = yield* postModern(
        createConvexTestWithBetterAuth(),
        18,
        "resources/read",
        { uri: missingUri },
        missingUri
      );
      expect(response.status).toBe(200);
      expect(yield* json(response)).toMatchObject({
        error: {
          code: -32_602,
          data: { uri: missingUri },
        },
        id: 18,
        jsonrpc: "2.0",
      });
    })
  );
  it.effect("executes tools through the shared Convex programs", () =>
    Effect.gen(function* () {
      const test = createConvexTestWithBetterAuth();
      const responses = yield* Effect.all([
        postModern(
          test,
          20,
          "tools/call",
          {
            arguments: {
              limit: 10,
              locale: "en",
              offset: 0,
              queries: ["algebra"],
            },
            name: "nakafa_search_content",
          },
          "nakafa_search_content"
        ),
        postModern(
          test,
          21,
          "tools/call",
          {
            arguments: {
              content_ref: "https://nakafa.com/en/articles/missing/content",
            },
            name: "nakafa_get_content",
          },
          "nakafa_get_content"
        ),
        postModern(
          test,
          22,
          "tools/call",
          { arguments: { locale: "en" }, name: "nakafa_get_taxonomy" },
          "nakafa_get_taxonomy"
        ),
        postModern(
          test,
          23,
          "tools/call",
          {
            arguments: { from_verse: 1, locale: "en", surah: 1 },
            name: "nakafa_get_quran_reference",
          },
          "nakafa_get_quran_reference"
        ),
      ]);
      const bodies = yield* Effect.all(responses.map(json));
      expect(responses.every(({ status }) => status === 200)).toBe(true);
      expect(bodies[0]).toMatchObject({
        result: {
          structuredContent: {
            count: 0,
            has_more: false,
            items: [],
            limit: 10,
            offset: 0,
          },
        },
      });
      for (const body of bodies.slice(1)) {
        expect(body).toMatchObject({
          result: {
            isError: true,
            structuredContent: {
              error: {
                message: expect.any(String),
                suggestions: [expect.any(String)],
              },
            },
          },
        });
      }
    })
  );
  it.effect("rejects the predecessor 2025 initialize handshake", () =>
    Effect.gen(function* () {
      const test = createConvexTestWithBetterAuth();
      const body = JSON.stringify({
        id: 30,
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          capabilities: {},
          clientInfo: { name: "predecessor-test", version: "1.0.0" },
          protocolVersion: MCP_PREDECESSOR_PROTOCOL_VERSION,
        },
      });
      const request = (headers: HeadersInit) =>
        fetchMcp(test, {
          body,
          headers: {
            accept: "application/json, text/event-stream",
            "content-type": "application/json",
            ...headers,
          },
          method: "POST",
        });
      const [missingHeader, predecessorHeader] = yield* Effect.all([
        request({}),
        request({
          "mcp-method": "initialize",
          "mcp-protocol-version": MCP_PREDECESSOR_PROTOCOL_VERSION,
        }),
      ]);
      expect(missingHeader.status).toBe(400);
      expect(yield* json(missingHeader)).toMatchObject({
        error: { code: -32_020 },
        id: 30,
        jsonrpc: "2.0",
      });
      expect(predecessorHeader.status).toBe(400);
      expect(yield* json(predecessorHeader)).toMatchObject({
        error: { code: -32_022 },
        id: 30,
        jsonrpc: "2.0",
      });
    })
  );
  it.effect("rejects modern traffic that omits its protocol header", () =>
    Effect.gen(function* () {
      const test = createConvexTestWithBetterAuth();
      const post = (body: Readonly<Record<string, unknown>>) =>
        fetchMcp(test, {
          body: JSON.stringify(body),
          headers: {
            accept: "application/json, text/event-stream",
            "content-type": "application/json",
            "mcp-method": "server/discover",
          },
          method: "POST",
        });
      const [response, notification] = yield* Effect.all([
        post({
          id: 31,
          jsonrpc: "2.0",
          method: "server/discover",
          params: { _meta: MODERN_META },
        }),
        post({
          jsonrpc: "2.0",
          method: "notifications/initialized",
          params: { _meta: MODERN_META },
        }),
      ]);
      expect(response.status).toBe(400);
      expect(yield* json(response)).toMatchObject({
        error: {
          code: -32_020,
          data: { request_id: expect.any(String) },
        },
        id: 31,
        jsonrpc: "2.0",
      });
      expect(notification.status).toBe(400);
      expect(yield* text(notification)).toBe("");
    })
  );
  it.effect("preserves SDK parse and method failures", () =>
    Effect.gen(function* () {
      const test = createConvexTestWithBetterAuth();
      const [malformed, get] = yield* Effect.all([
        fetchMcp(test, {
          body: "{",
          headers: {
            accept: "application/json, text/event-stream",
            "content-type": "application/json",
          },
          method: "POST",
        }),
        fetchMcp(test),
      ]);
      expect(malformed.status).toBe(400);
      expect(yield* json(malformed)).toMatchObject({
        error: { code: -32_700 },
        jsonrpc: "2.0",
      });
      expect(get.status).toBe(405);
    })
  );
  it.effect(
    "rejects oversized declared and streaming bodies before SDK parsing",
    () =>
      Effect.gen(function* () {
        const test = createConvexTestWithBetterAuth();
        const notification = JSON.stringify({
          jsonrpc: "2.0",
          method: "notifications/initialized",
          padding: "x".repeat(65_537),
        });
        const declared = yield* fetchMcp(test, {
          headers: {
            "content-length": "65537",
            "content-type": "application/json",
          },
          method: "POST",
        });
        const streamed = yield* fetchMcp(test, {
          body: notification,
          headers: { "content-type": "application/json" },
          method: "POST",
        });
        for (const response of [declared, streamed]) {
          expect(response.status).toBe(413);
          expect(yield* text(response)).toBe("");
        }
      })
  );
  it.effect(
    "charges rejected bodies and keeps transport failures bodyless",
    () =>
      Effect.gen(function* () {
        vi.spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
        const test = createConvexTestWithBetterAuth();
        const notificationBody = JSON.stringify({
          jsonrpc: "2.0",
          method: "notifications/initialized",
        });
        const allowed = yield* Effect.all(
          Array.from({ length: 29 }, (_, index) =>
            postModern(test, 100 + index, "server/discover")
          )
        );
        const rejected = yield* fetchMcp(test, {
          headers: {
            "content-length": "65537",
            "content-type": "application/json",
          },
          method: "POST",
        });
        const throttled = yield* fetchMcp(test, {
          body: notificationBody,
          headers: { "content-type": "application/json" },
          method: "POST",
        });
        const unavailable = yield* fetchMcp(test, {
          body: notificationBody,
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": "",
          },
          method: "POST",
        });
        expect(allowed.every(({ status }) => status === 200)).toBe(true);
        expect(rejected.status).toBe(413);
        expect([throttled.status, unavailable.status]).toEqual([429, 503]);
        expect(throttled.headers.get("content-type")).toBeNull();
        expect(throttled.headers.get("retry-after")).toBe("1");
        for (const response of [throttled, unavailable]) {
          expect(yield* text(response)).toBe("");
        }
      })
  );
});
