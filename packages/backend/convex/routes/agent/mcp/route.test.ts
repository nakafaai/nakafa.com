// @vitest-environment node

import {
  CLIENT_CAPABILITIES_META_KEY,
  CLIENT_INFO_META_KEY,
  LATEST_PROTOCOL_VERSION as MCP_PREDECESSOR_PROTOCOL_VERSION,
  PROTOCOL_VERSION_META_KEY,
} from "@modelcontextprotocol/server";
import { NAKAFA_MCP_EDGE_CONTRACT } from "@repo/backend/agent/edge";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { NAKAFA_MCP_PROTOCOL_VERSION } from "@repo/contents/_lib/agent/constants";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "@repo/testing/effect";
import { vi } from "vitest";

const MCP_SECRET = "technical-mcp-edge-secret";
const MODERN_META = {
  [CLIENT_CAPABILITIES_META_KEY]: {},
  [CLIENT_INFO_META_KEY]: {
    name: "nakafa-test-client",
    version: "1.0.0",
  },
  [PROTOCOL_VERSION_META_KEY]: NAKAFA_MCP_PROTOCOL_VERSION,
};
type BackendTest = ReturnType<typeof createConvexTestWithBetterAuth>;

function fetchMcp(test: BackendTest, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set(NAKAFA_MCP_EDGE_CONTRACT.secretHeader, MCP_SECRET);
  headers.set("x-forwarded-for", "203.0.113.21");
  return test.fetch(NAKAFA_MCP_EDGE_CONTRACT.originPath, {
    ...init,
    headers,
  });
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

beforeEach(() => {
  vi.stubEnv(NAKAFA_MCP_EDGE_CONTRACT.secretEnvironment, MCP_SECRET);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("Nakafa MCP transport", () => {
  it("serves current discovery and the established tool surface", async () => {
    const test = createConvexTestWithBetterAuth();
    const discover = await postModern(test, 1, "server/discover");
    const discoverBody = await discover.json();
    const tools = await postModern(test, 2, "tools/list");
    const toolsBody = await tools.json();

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
  });

  it("preserves static resources, templates, and prompts", async () => {
    const test = createConvexTestWithBetterAuth();
    const usageUri = "nakafa://usage";
    const responses = await Promise.all([
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
    const bodies = await Promise.all(
      responses.map((response) => response.json())
    );

    expect(responses.map(({ status }) => status)).toEqual([
      200, 200, 200, 200, 200,
    ]);
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
  });

  it("renders every workflow prompt through strict argument contracts", async () => {
    const test = createConvexTestWithBetterAuth();
    const responses = await Promise.all([
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
    const bodies = await Promise.all(
      responses.map((response) => response.json())
    );

    expect(responses.map(({ status }) => status)).toEqual([200, 200, 200]);
    expect(bodies[0]).toMatchObject({
      result: {
        messages: [
          {
            content: {
              text: expect.stringContaining("What is the key idea?"),
            },
          },
        ],
      },
    });
    expect(bodies[1]).toMatchObject({
      result: {
        messages: [
          {
            content: {
              text: expect.stringContaining("Surah 1, verses 1-7"),
            },
          },
        ],
      },
    });
    expect(bodies[2]).toMatchObject({
      error: { code: -32_602 },
      id: 17,
      jsonrpc: "2.0",
    });
  });

  it("returns typed resource failures without inventing content", async () => {
    const missingUri = "nakafa://content/asset:en:article:missing";
    const response = await postModern(
      createConvexTestWithBetterAuth(),
      18,
      "resources/read",
      { uri: missingUri },
      missingUri
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: -32_602,
        data: { uri: missingUri },
      },
      id: 18,
      jsonrpc: "2.0",
    });
  });

  it("executes tools through the shared Convex programs", async () => {
    const test = createConvexTestWithBetterAuth();
    const responses = await Promise.all([
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
    const bodies = await Promise.all(
      responses.map((response) => response.json())
    );

    expect(responses.map(({ status }) => status)).toEqual([200, 200, 200, 200]);
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
  });

  it("serves the predecessor 2025 initialize handshake", async () => {
    const response = await fetchMcp(createConvexTestWithBetterAuth(), {
      body: JSON.stringify({
        id: 30,
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          capabilities: {},
          clientInfo: { name: "legacy-test", version: "1.0.0" },
          protocolVersion: MCP_PREDECESSOR_PROTOCOL_VERSION,
        },
      }),
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
      },
      method: "POST",
    });
    const body = await response.text();

    expect(response.status, body).toBe(200);
    expect(body).toContain(MCP_PREDECESSOR_PROTOCOL_VERSION);
    expect(body).toContain("nakafa-mcp-server");
  });

  it("rejects modern traffic that omits its protocol header", async () => {
    const response = await fetchMcp(createConvexTestWithBetterAuth(), {
      body: JSON.stringify({
        id: 31,
        jsonrpc: "2.0",
        method: "server/discover",
        params: { _meta: MODERN_META },
      }),
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "mcp-method": "server/discover",
      },
      method: "POST",
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: -32_020,
        data: { request_id: expect.any(String) },
      },
      id: 31,
      jsonrpc: "2.0",
    });
  });

  it("preserves SDK parse and method failures", async () => {
    const test = createConvexTestWithBetterAuth();
    const [malformed, get] = await Promise.all([
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
    await expect(malformed.json()).resolves.toMatchObject({
      error: { code: -32_700 },
      jsonrpc: "2.0",
    });
    expect(get.status).toBe(405);
  });

  it("rejects oversized declared and streaming bodies before SDK parsing", async () => {
    const test = createConvexTestWithBetterAuth();
    const declared = await fetchMcp(test, {
      headers: {
        "content-length": "65537",
        "content-type": "application/json",
      },
      method: "POST",
    });
    const streamed = await fetchMcp(test, {
      body: "x".repeat(65_537),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    for (const response of [declared, streamed]) {
      expect(response.status).toBe(413);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: -32_013 },
        id: null,
        jsonrpc: "2.0",
      });
    }
  });

  it("charges rejected bodies and returns no JSON-RPC for throttled notifications", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
    const test = createConvexTestWithBetterAuth();
    const allowed = await Promise.all(
      Array.from({ length: 29 }, (_, index) =>
        postModern(test, 100 + index, "server/discover")
      )
    );
    const rejected = await fetchMcp(test, {
      headers: {
        "content-length": "65537",
        "content-type": "application/json",
      },
      method: "POST",
    });
    const throttled = await fetchMcp(test, {
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    expect(allowed.every(({ status }) => status === 200)).toBe(true);
    expect(rejected.status).toBe(413);
    expect(throttled.status).toBe(429);
    expect(throttled.headers.get("content-type")).toBeNull();
    expect(throttled.headers.get("retry-after")).toBe("1");
    await expect(throttled.text()).resolves.toBe("");
  });
});
