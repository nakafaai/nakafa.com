// @vitest-environment node

import { describe, expect, it } from "vitest";

const WEB_BASE_URL =
  process.env.AGENT_SURFACE_WEB_BASE_URL ?? "https://nakafa.com";
const API_BASE_URL =
  process.env.AGENT_SURFACE_API_BASE_URL ?? "https://api.nakafa.com";
const MCP_BASE_URL =
  process.env.AGENT_SURFACE_MCP_BASE_URL ?? "https://mcp.nakafa.com";
const CONVEX_SITE_URL =
  process.env.AGENT_SURFACE_CONVEX_SITE_URL ??
  "https://dapper-antelope-269.convex.site";
const PROTOCOL_VERSION = "2026-07-28";
const REQUEST_TIMEOUT_MS = 30_000;
const H1_PATTERN = /<h1\b/giu;
const H2_PATTERN = /<h2\b/iu;
const H3_PATTERN = /<h3\b/iu;
const CRAWLER_USER_AGENTS = [
  "ChatGPT-User",
  "ClaudeBot",
  "Google-Extended",
  "ora-agent",
  "DeepSeekBot",
];

function request(url: string, init: RequestInit = {}) {
  return fetch(url, {
    ...init,
    headers: {
      "User-Agent": "nakafa-agent-surface-check/1.0",
      ...init.headers,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

function visibleText(source: string) {
  return source
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&(?:amp|apos|gt|lt|nbsp|quot);/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function varyFields(response: Response) {
  return new Set(
    (response.headers.get("vary") ?? "")
      .split(",")
      .map((field) => field.trim().toLowerCase())
      .filter(Boolean)
  );
}

function readJsonLd(source: string) {
  return [
    ...source.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/giu
    ),
  ].map((match) => JSON.parse(match[1] ?? "null"));
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasSchemaType(value: unknown, type: string): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => hasSchemaType(item, type));
  }
  if (!isRecord(value)) {
    return false;
  }
  if (value["@type"] === type) {
    return true;
  }
  return Object.values(value).some((item) => hasSchemaType(item, type));
}

describe("Nakafa public agent surface", () => {
  it.each(CRAWLER_USER_AGENTS)(
    "serves raw homepage content to %s",
    async (agent) => {
      const response = await request(`${WEB_BASE_URL}/`, {
        headers: { "User-Agent": agent },
      });
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
      expect((html.match(H1_PATTERN) ?? []).length).toBe(1);
      expect(html).toMatch(H2_PATTERN);
      expect(html).toMatch(H3_PATTERN);
      expect(visibleText(html).length).toBeGreaterThan(500);
    }
  );

  it("negotiates Markdown without cross-variant cache poisoning", async () => {
    const response = await request(`${WEB_BASE_URL}/`, {
      headers: { Accept: "text/markdown" },
    });
    const markdown = await response.text();
    const vary = varyFields(response);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/markdown");
    expect(vary.has("accept")).toBe(true);
    expect(vary.has("accept-encoding")).toBe(true);
    expect(markdown.length).toBeGreaterThan(500);
    expect(markdown).toContain("# Nakafa");
  });

  it.each([
    ["/llms.txt", "When to use Nakafa"],
    ["/developers/llms.txt", "Nakafa Developer Resources"],
    ["/skill.md", "Use this skill when"],
  ])("serves machine-readable discovery at %s", async (path, marker) => {
    const response = await request(`${WEB_BASE_URL}${path}`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/markdown");
    expect(body).toContain(marker);
  });

  it("publishes complete developer and contact trust pages", async () => {
    const paths = ["/developers", "/en/contact", "/id/contact", "/de/contact"];
    const responses = await Promise.all(
      paths.map((path) => request(`${WEB_BASE_URL}${path}`))
    );
    const bodies = await Promise.all(
      responses.map((response) => response.text())
    );

    expect(responses.map(({ status }) => status)).toEqual([200, 200, 200, 200]);
    for (const body of bodies) {
      expect(visibleText(body).length).toBeGreaterThan(500);
    }
  });

  it("serves one identical valid OpenAPI 3.1 contract", async () => {
    const [webResponse, apiResponse] = await Promise.all([
      request(`${WEB_BASE_URL}/openapi.json`),
      request(`${API_BASE_URL}/openapi.json`),
    ]);
    const [webDocument, apiDocument] = await Promise.all([
      webResponse.json(),
      apiResponse.json(),
    ]);

    expect([webResponse.status, apiResponse.status]).toEqual([200, 200]);
    expect(webDocument).toEqual(apiDocument);
    expect(apiDocument).toMatchObject({
      info: { title: "Nakafa Public API" },
      openapi: "3.1.1",
      servers: [{ url: "https://api.nakafa.com" }],
    });
  });

  it("serves public REST and structured route errors through the edge", async () => {
    const [index, health, search, missing] = await Promise.all([
      request(`${API_BASE_URL}/v1`),
      request(`${API_BASE_URL}/v1/health`),
      request(`${API_BASE_URL}/v1/search?query=algebra&limit=1`),
      request(`${API_BASE_URL}/v1/missing`),
    ]);
    const [indexBody, healthBody, searchBody, missingBody] = await Promise.all([
      index.json(),
      health.json(),
      search.json(),
      missing.json(),
    ]);

    expect([
      index.status,
      health.status,
      search.status,
      missing.status,
    ]).toEqual([200, 200, 200, 404]);
    expect(indexBody).toMatchObject({
      authentication: "none",
      version: "1.0.0",
    });
    expect(healthBody).toMatchObject({ status: "ok" });
    expect(searchBody).toMatchObject({ limit: 1, offset: 0 });
    expect(missing.headers.get("content-type")).toContain(
      "application/problem+json"
    );
    expect(missingBody).toMatchObject({
      code: "ENDPOINT_NOT_FOUND",
      status: 404,
    });
  });

  it("rejects direct access to protected Convex origins", async () => {
    const [apiResponse, mcpResponse] = await Promise.all([
      request(`${CONVEX_SITE_URL}/v1/health`),
      request(`${CONVEX_SITE_URL}/mcp`),
    ]);

    expect([apiResponse.status, mcpResponse.status]).toEqual([403, 403]);
    expect(apiResponse.headers.get("content-type")).toContain(
      "application/problem+json"
    );
    expect(mcpResponse.headers.get("content-type")).toContain(
      "application/json"
    );
  });

  it("publishes MCP discovery and current-protocol tool metadata", async () => {
    const [manifestResponse, toolsResponse] = await Promise.all([
      request(`${MCP_BASE_URL}/mcp`),
      request(`${MCP_BASE_URL}/mcp`, {
        body: JSON.stringify({
          id: 1,
          jsonrpc: "2.0",
          method: "tools/list",
          params: {
            _meta: {
              "io.modelcontextprotocol/clientCapabilities": {},
              "io.modelcontextprotocol/clientInfo": {
                name: "nakafa-agent-surface-check",
                version: "1.0.0",
              },
              "io.modelcontextprotocol/protocolVersion": PROTOCOL_VERSION,
            },
          },
        }),
        headers: {
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
          "MCP-Method": "tools/list",
          "MCP-Protocol-Version": PROTOCOL_VERSION,
        },
        method: "POST",
      }),
    ]);
    const [manifest, tools] = await Promise.all([
      manifestResponse.json(),
      toolsResponse.json(),
    ]);

    expect([manifestResponse.status, toolsResponse.status]).toEqual([200, 200]);
    expect(manifest).toMatchObject({
      name: "io.github.nakafaai/nakafa",
      remotes: [{ url: "https://mcp.nakafa.com/mcp" }],
    });
    expect(
      tools.result.tools.map(({ name }: { name: string }) => name)
    ).toEqual([
      "nakafa_search_content",
      "nakafa_get_content",
      "nakafa_get_taxonomy",
      "nakafa_get_quran_reference",
    ]);
  });

  it("publishes complete Organization and founder Person JSON-LD", async () => {
    const response = await request(`${WEB_BASE_URL}/`);
    const documents = readJsonLd(await response.text());

    expect(
      documents.some((document) => hasSchemaType(document, "Organization"))
    ).toBe(true);
    expect(
      documents.some((document) => hasSchemaType(document, "Person"))
    ).toBe(true);
    expect(JSON.stringify(documents)).toContain("contactPoint");
    expect(JSON.stringify(documents)).toContain('"jobTitle":"Founder"');
  });
});
