// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { TOOL_CALL_CASES } from "@repo/backend/test/mcp/calls";
import { DISCOVERY_CASES } from "@repo/backend/test/mcp/discovery";
import {
  jsonBody,
  MCP_CLIENT_META,
  MCP_PREDECESSOR_PROTOCOL_VERSION,
  MCP_SECRET,
  MCP_SECRET_ENVIRONMENT,
  type McpCase,
  type McpRequest,
  modernPost,
  pinMcpClock,
  readMcpAnswer,
  sendMcpCase,
  sendMcpRequest,
} from "@repo/backend/test/mcp/harness";
import { HTTP_CASES } from "@repo/backend/test/mcp/http";
import { INVALID_TOOL_CALL_CASES } from "@repo/backend/test/mcp/invalid";
import { JSON_RPC_CASES } from "@repo/backend/test/mcp/jsonrpc";
import { PROMPT_CASES } from "@repo/backend/test/mcp/prompts";
import { PROTOCOL_CASES } from "@repo/backend/test/mcp/protocol";
import { RESOURCE_CASES } from "@repo/backend/test/mcp/resources";
import { Array as Arr, Effect } from "effect";

type BackendTest = ReturnType<typeof createConvexTestWithBetterAuth>;
const json = (response: Response) => Effect.promise(() => response.json());
const text = (response: Response) => Effect.promise(() => response.text());
const allConcurrently = <const A extends Iterable<Effect.All.EffectAny>>(
  effects: A
) => Effect.all(effects, { concurrency: "unbounded" });
function send(test: BackendTest, request: McpRequest) {
  return Effect.promise(() => sendMcpRequest(test, request));
}
beforeEach(() => vi.stubEnv(MCP_SECRET_ENVIRONMENT, MCP_SECRET));
afterEach(() => {
  vi.doUnmock("@repo/backend/agent/mcp/server");
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
/** Sends one golden case and compares its complete answer with the pinned one. */
const runGoldenCase = Effect.fn("TestMcp.runGoldenCase")(function* (
  testCase: McpCase
) {
  const response = yield* Effect.promise(() => sendMcpCase(testCase));
  const answer = yield* readMcpAnswer(response, testCase.answer.body);
  expect(answer).toStrictEqual(testCase.answer);
});
describe("Nakafa MCP golden contract", () => {
  describe("discovery and lists", () => {
    it.effect.each(DISCOVERY_CASES)("$name", runGoldenCase);
  });
  describe("tool calls", () => {
    it.effect.each(TOOL_CALL_CASES)("$name", runGoldenCase);
    it.effect.each(INVALID_TOOL_CALL_CASES)("$name", runGoldenCase);
  });
  describe("prompts", () => {
    it.effect.each(PROMPT_CASES)("$name", runGoldenCase);
  });
  describe("resources", () => {
    it.effect.each(RESOURCE_CASES)("$name", runGoldenCase);
  });
  describe("protocol headers", () => {
    it.effect.each(PROTOCOL_CASES)("$name", runGoldenCase);
  });
  describe("JSON-RPC shape", () => {
    it.effect.each(JSON_RPC_CASES)("$name", runGoldenCase);
  });
  describe("HTTP shape", () => {
    it.effect.each(HTTP_CASES)("$name", runGoldenCase);
  });
});
describe("Nakafa MCP transport", () => {
  it.effect("serves current discovery and the established tool surface", () =>
    Effect.gen(function* () {
      const test = createConvexTestWithBetterAuth();
      const discover = yield* send(test, modernPost(1, "server/discover"));
      const discoverBody = yield* json(discover);
      const tools = yield* send(test, modernPost(2, "tools/list"));
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
  it.effect(
    "renders every workflow prompt through strict argument contracts",
    () =>
      Effect.gen(function* () {
        const test = createConvexTestWithBetterAuth();
        const responses = yield* allConcurrently([
          send(
            test,
            modernPost(
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
            )
          ),
          send(
            test,
            modernPost(
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
            )
          ),
          send(
            test,
            modernPost(
              17,
              "prompts/get",
              {
                arguments: { topic: "" },
                name: "nakafa_find_lesson",
              },
              "nakafa_find_lesson"
            )
          ),
        ]);
        const bodies = yield* allConcurrently(Arr.map(responses, json));
        expect(Arr.map(responses, ({ status }) => status)).toEqual([
          200, 200, 200,
        ]);
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
      const response = yield* send(
        createConvexTestWithBetterAuth(),
        modernPost(18, "resources/read", { uri: missingUri }, missingUri)
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
      const responses = yield* allConcurrently([
        send(
          test,
          modernPost(
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
          )
        ),
        send(
          test,
          modernPost(
            21,
            "tools/call",
            {
              arguments: {
                content_ref: "https://nakafa.com/en/articles/missing/content",
              },
              name: "nakafa_get_content",
            },
            "nakafa_get_content"
          )
        ),
        send(
          test,
          modernPost(
            22,
            "tools/call",
            { arguments: { locale: "en" }, name: "nakafa_get_taxonomy" },
            "nakafa_get_taxonomy"
          )
        ),
        send(
          test,
          modernPost(
            23,
            "tools/call",
            {
              arguments: { from_verse: 1, locale: "en", surah: 1 },
              name: "nakafa_get_quran_reference",
            },
            "nakafa_get_quran_reference"
          )
        ),
      ]);
      const bodies = yield* allConcurrently(Arr.map(responses, json));
      expect(Arr.every(responses, ({ status }) => status === 200)).toBe(true);
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
      const body = jsonBody({
        id: 30,
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          capabilities: {},
          clientInfo: { name: "predecessor-test", version: "1.0.0" },
          protocolVersion: MCP_PREDECESSOR_PROTOCOL_VERSION,
        },
      });
      const request = (headers: Readonly<Record<string, string>>) =>
        send(test, {
          body,
          headers: {
            accept: "application/json, text/event-stream",
            "content-type": "application/json",
            ...headers,
          },
          method: "POST",
        });
      const [missingHeader, predecessorHeader] = yield* allConcurrently([
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
        send(test, {
          body: jsonBody(body),
          headers: {
            accept: "application/json, text/event-stream",
            "content-type": "application/json",
            "mcp-method": "server/discover",
          },
          method: "POST",
        });
      const [response, notification] = yield* allConcurrently([
        post({
          id: 31,
          jsonrpc: "2.0",
          method: "server/discover",
          params: { _meta: MCP_CLIENT_META },
        }),
        post({
          jsonrpc: "2.0",
          method: "notifications/initialized",
          params: { _meta: MCP_CLIENT_META },
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
      const [malformed, get] = yield* allConcurrently([
        send(test, {
          body: "{",
          headers: {
            accept: "application/json, text/event-stream",
            "content-type": "application/json",
          },
          method: "POST",
        }),
        send(test, { method: "GET" }),
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
        const notification = jsonBody({
          jsonrpc: "2.0",
          method: "notifications/initialized",
          padding: "x".repeat(65_537),
        });
        const declared = yield* send(test, {
          headers: {
            "content-length": "65537",
            "content-type": "application/json",
          },
          method: "POST",
        });
        const streamed = yield* send(test, {
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
        pinMcpClock();
        const test = createConvexTestWithBetterAuth();
        const notificationBody = jsonBody({
          jsonrpc: "2.0",
          method: "notifications/initialized",
        });
        const allowed = yield* allConcurrently(
          Array.from({ length: 29 }, (_, index) =>
            send(test, modernPost(100 + index, "server/discover"))
          )
        );
        const rejected = yield* send(test, {
          headers: {
            "content-length": "65537",
            "content-type": "application/json",
          },
          method: "POST",
        });
        const throttled = yield* send(test, {
          body: notificationBody,
          headers: { "content-type": "application/json" },
          method: "POST",
        });
        const unavailable = yield* send(test, {
          body: notificationBody,
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": "",
          },
          method: "POST",
        });
        expect(Arr.every(allowed, ({ status }) => status === 200)).toBe(true);
        expect(rejected.status).toBe(413);
        expect([throttled.status, unavailable.status]).toEqual([429, 503]);
        expect(throttled.headers.get("content-type")).toBeNull();
        expect(throttled.headers.get("retry-after")).toBe("1");
        for (const response of [throttled, unavailable]) {
          expect(yield* text(response)).toBe("");
        }
      })
  );
  it.effect("rejects mismatched body framing before the protocol loader", () =>
    Effect.gen(function* () {
      const response = yield* send(createConvexTestWithBetterAuth(), {
        body: "{}",
        headers: { "content-length": "1", "content-type": "application/json" },
        method: "POST",
      });
      expect(response.status).toBe(400);
      expect(yield* text(response)).toBe("");
    })
  );
  it.effect(
    "returns a sanitized retryable failure if the protocol module fails to load",
    () =>
      Effect.gen(function* () {
        vi.doMock("@repo/backend/agent/mcp/server", () => {
          throw new Error("private module initialization failure");
        });
        const response = yield* send(
          createConvexTestWithBetterAuth(),
          modernPost(99, "server/discover")
        );
        expect(response.status).toBe(503);
        expect(yield* json(response)).toMatchObject({
          id: 99,
          error: {
            code: -32_603,
            message: "The MCP protocol runtime is unavailable.",
          },
        });
      })
  );
});
