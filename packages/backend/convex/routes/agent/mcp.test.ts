// @vitest-environment node
import { NAKAFA_MCP_PROTOCOL_VERSION } from "@repo/backend/agent/mcp/protocol";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "@repo/testing/effect";

const MCP_SECRET = "technical-mcp-edge-secret";
const MCP_SECRET_NAME = "NAKAFA_MCP_EDGE_SECRET";
const MCP_ORIGINS_NAME = "NAKAFA_MCP_ALLOWED_ORIGINS";
const POLAR_SECRET_NAME = "POLAR_WEBHOOK_SECRET";
const MODERN_META = {
  "io.modelcontextprotocol/clientCapabilities": {},
  "io.modelcontextprotocol/clientInfo": {
    name: "nakafa-test-client",
    version: "1.0.0",
  },
  "io.modelcontextprotocol/protocolVersion": NAKAFA_MCP_PROTOCOL_VERSION,
};

/** Sends one request through the protected MCP HTTP Action. */
function fetchMcp(init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("x-nakafa-mcp-edge-secret", MCP_SECRET);
  return createConvexTestWithBetterAuth().fetch("/mcp", { ...init, headers });
}

/** Sends one current-protocol JSON request with required metadata headers. */
function postModern(
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
  if (name) {
    headers.set("mcp-name", name);
  }
  return fetchMcp({
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

/** Decodes one JSON-RPC message carried by the legacy SSE response mode. */
async function readLegacyMessage(response: Response) {
  const source = await response.text();
  const data = source
    .split("\n")
    .find((line) => line.startsWith("data: "))
    ?.slice("data: ".length);
  if (!data) {
    throw new Error("Expected one legacy SSE data event.");
  }
  return JSON.parse(data) as {
    readonly result?: {
      readonly prompts?: readonly { readonly name: string }[];
      readonly protocolVersion?: string;
      readonly resources?: readonly { readonly uri: string }[];
      readonly tools?: readonly { readonly name: string }[];
    };
  };
}

beforeEach(() => {
  process.env[MCP_SECRET_NAME] = MCP_SECRET;
  process.env[MCP_ORIGINS_NAME] =
    "https://nakafa.com,https://agent.example.com";
  process.env[POLAR_SECRET_NAME] = "technical-webhook-secret";
});

afterEach(() => {
  delete process.env[MCP_SECRET_NAME];
  delete process.env[MCP_ORIGINS_NAME];
  delete process.env[POLAR_SECRET_NAME];
});

describe("Nakafa MCP HTTP route", () => {
  it("returns a JSON-RPC 405 with the supported transport methods", async () => {
    const response = await fetchMcp({ method: "PUT" });

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, POST, OPTIONS");
    await expect(response.json()).resolves.toMatchObject({
      error: { code: -32_600 },
      id: null,
      jsonrpc: "2.0",
    });
  });

  it("serves a valid Registry manifest through the protected edge path", async () => {
    const response = await fetchMcp();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8"
    );
    await expect(response.json()).resolves.toMatchObject({
      name: "io.github.nakafaai/nakafa",
      remotes: [
        {
          type: "streamable-http",
          url: "https://mcp.nakafa.com/mcp",
        },
      ],
    });
  });

  it("rejects missing edge authentication and untrusted browser Origins", async () => {
    const direct = await createConvexTestWithBetterAuth().fetch("/mcp");
    const untrusted = await fetchMcp({
      headers: { origin: "https://evil.example.com" },
    });

    expect(direct.status).toBe(403);
    expect(direct.headers.get("access-control-expose-headers")).toBe(
      "MCP-Protocol-Version, MCP-Session-Id"
    );
    await expect(direct.json()).resolves.toMatchObject({
      error: {
        data: { request_id: expect.any(String) },
        message: "Direct access to this Convex MCP origin is not allowed.",
      },
      jsonrpc: "2.0",
    });
    expect(untrusted.status).toBe(403);
    await expect(untrusted.json()).resolves.toMatchObject({
      error: {
        message: "The browser Origin is not trusted by this MCP server.",
      },
    });
  });

  it("allows configured browser preflight requests and absent server Origins", async () => {
    const browser = await fetchMcp({
      headers: { origin: "https://agent.example.com" },
      method: "OPTIONS",
    });
    const server = await fetchMcp({ method: "OPTIONS" });

    expect(browser.status).toBe(204);
    expect(browser.headers.get("access-control-allow-origin")).toBe(
      "https://agent.example.com"
    );
    expect(browser.headers.get("access-control-expose-headers")).toBe(
      "MCP-Protocol-Version, MCP-Session-Id"
    );
    expect(server.status).toBe(204);
    expect(server.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("implements current server discovery and typed tool listing", async () => {
    const discover = await postModern(1, "server/discover");
    const list = await postModern(2, "tools/list");
    const discoverBody = await discover.json();
    const listBody = await list.json();

    expect(discover.status, JSON.stringify(discoverBody)).toBe(200);
    expect(discover.headers.get("mcp-protocol-version")).toBe(
      NAKAFA_MCP_PROTOCOL_VERSION
    );
    expect(discover.headers.get("content-type")).toContain("application/json");
    expect(discoverBody).toMatchObject({
      id: 1,
      result: {
        supportedVersions: [NAKAFA_MCP_PROTOCOL_VERSION],
      },
    });
    expect(list.status, JSON.stringify(listBody)).toBe(200);
    expect(list.headers.get("content-type")).toContain("application/json");
    expect(
      listBody.result.tools.map((tool: { name: string }) => tool.name)
    ).toEqual([
      "nakafa_search_content",
      "nakafa_get_content",
      "nakafa_get_taxonomy",
      "nakafa_get_quran_reference",
    ]);
    for (const tool of listBody.result.tools) {
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toMatchObject({ type: "object" });
      expect(tool.outputSchema).toMatchObject({ type: "object" });
      expect(tool.annotations).toMatchObject({
        destructiveHint: false,
        readOnlyHint: true,
      });
    }
  });

  it("calls all four tools through the shared Convex programs", async () => {
    const calls = await Promise.all([
      postModern(
        10,
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
        11,
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
        12,
        "tools/call",
        { arguments: { locale: "en" }, name: "nakafa_get_taxonomy" },
        "nakafa_get_taxonomy"
      ),
      postModern(
        13,
        "tools/call",
        {
          arguments: { from_verse: 1, locale: "en", surah: 1 },
          name: "nakafa_get_quran_reference",
        },
        "nakafa_get_quran_reference"
      ),
    ]);
    const bodies = await Promise.all(calls.map((response) => response.json()));

    expect(
      calls.map((response) => response.status),
      JSON.stringify(bodies)
    ).toEqual([200, 200, 200, 200]);
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
      expect(body.result).toMatchObject({
        isError: true,
        content: [{ type: "text" }],
      });
    }
  });

  it("returns JSON-RPC errors for malformed JSON and protocol mismatches", async () => {
    const malformed = await fetchMcp({
      body: "{",
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
      },
      method: "POST",
    });
    const mismatch = await fetchMcp({
      body: JSON.stringify({
        id: 20,
        jsonrpc: "2.0",
        method: "server/discover",
        params: { _meta: MODERN_META },
      }),
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "mcp-method": "server/discover",
        "mcp-protocol-version": "2025-11-25",
      },
      method: "POST",
    });

    expect(malformed.status).toBe(400);
    await expect(malformed.json()).resolves.toMatchObject({
      error: { code: -32_700 },
      jsonrpc: "2.0",
    });
    expect(mismatch.status).toBe(400);
    await expect(mismatch.json()).resolves.toMatchObject({
      error: { code: -32_020 },
      id: 20,
      jsonrpc: "2.0",
    });
  });

  it("rejects missing or mismatched current-protocol routing headers", async () => {
    const missingMethod = await fetchMcp({
      body: JSON.stringify({
        id: 22,
        jsonrpc: "2.0",
        method: "server/discover",
        params: { _meta: MODERN_META },
      }),
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        "mcp-protocol-version": NAKAFA_MCP_PROTOCOL_VERSION,
      },
      method: "POST",
    });
    const mismatchedName = await fetchMcp({
      body: JSON.stringify({
        id: 23,
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          _meta: MODERN_META,
          arguments: {},
          name: "nakafa_get_taxonomy",
        },
      }),
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        "mcp-method": "tools/call",
        "mcp-name": "nakafa_search_content",
        "mcp-protocol-version": NAKAFA_MCP_PROTOCOL_VERSION,
      },
      method: "POST",
    });

    expect(missingMethod.status).toBe(400);
    await expect(missingMethod.json()).resolves.toMatchObject({
      error: { code: -32_020 },
      id: 22,
      jsonrpc: "2.0",
    });
    expect(mismatchedName.status).toBe(400);
    await expect(mismatchedName.json()).resolves.toMatchObject({
      error: { code: -32_020 },
      id: 23,
      jsonrpc: "2.0",
    });
  });

  it("requires the protocol-version header on modern requests", async () => {
    const response = await fetchMcp({
      body: JSON.stringify({
        id: 21,
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
    expect(response.headers.get("mcp-protocol-version")).toBe(
      NAKAFA_MCP_PROTOCOL_VERSION
    );
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: -32_020,
        data: { request_id: expect.any(String) },
      },
      id: 21,
      jsonrpc: "2.0",
    });
  });

  it("retains stateless compatibility for 2025 protocol clients", async () => {
    const initialize = await fetchMcp({
      body: JSON.stringify({
        id: 30,
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          capabilities: {},
          clientInfo: { name: "legacy-test", version: "1.0.0" },
          protocolVersion: "2025-11-25",
        },
      }),
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
      },
      method: "POST",
    });
    const legacyRequest = (id: number, method: string) =>
      fetchMcp({
        body: JSON.stringify({ id, jsonrpc: "2.0", method, params: {} }),
        headers: {
          accept: "application/json, text/event-stream",
          "content-type": "application/json",
          "mcp-protocol-version": "2025-11-25",
        },
        method: "POST",
      });
    const [list, resources, prompts] = await Promise.all([
      legacyRequest(31, "tools/list"),
      legacyRequest(32, "resources/list"),
      legacyRequest(33, "prompts/list"),
    ]);
    const initializeBody = await readLegacyMessage(initialize);
    const [listBody, resourcesBody, promptsBody] = await Promise.all([
      readLegacyMessage(list),
      readLegacyMessage(resources),
      readLegacyMessage(prompts),
    ]);

    expect(initialize.status).toBe(200);
    expect(initializeBody.result?.protocolVersion).toBe("2025-11-25");
    expect(list.status).toBe(200);
    expect(listBody.result?.tools?.map(({ name }) => name)).toEqual([
      "nakafa_search_content",
      "nakafa_get_content",
      "nakafa_get_taxonomy",
      "nakafa_get_quran_reference",
    ]);
    expect(resourcesBody.result?.resources?.map(({ uri }) => uri)).toEqual([
      "nakafa://usage",
      "nakafa://taxonomy",
    ]);
    expect(promptsBody.result?.prompts?.map(({ name }) => name)).toEqual([
      "nakafa_find_lesson",
      "nakafa_answer_from_content",
      "nakafa_quran_reference",
    ]);
  });
});
