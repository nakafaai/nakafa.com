// @vitest-environment node
import {
  NAKAFA_API_EDGE_CONTRACT,
  NAKAFA_EDGE_CLIENT_IP_HEADER,
} from "@repo/backend/agent/edge";
import { components } from "@repo/backend/convex/_generated/api";
import {
  AGENT_RATE_LIMIT_CONFIG,
  AGENT_RATE_LIMIT_MAX_REQUESTS,
  deriveAgentRateLimitKey,
  getAgentRateLimitName,
} from "@repo/backend/convex/routes/agent/rateLimit";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "@repo/testing/effect";
import { Effect } from "effect";

const API_SECRET = "technical-api-edge-secret";
const POLAR_SECRET_NAME = "POLAR_WEBHOOK_SECRET";
const PROBLEM_TYPE_PATTERN = /^https:\/\/nakafa\.com\/problems\//u;

/** Sends one request through the real Convex HTTP router and edge guard. */
function fetchApi(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set(NAKAFA_API_EDGE_CONTRACT.secretHeader, API_SECRET);
  return createConvexTestWithBetterAuth().fetch(path, { ...init, headers });
}

/** Asserts the public API response metadata shared by JSON outcomes. */
function expectPublicJson(response: Response) {
  expect(response.headers.get("access-control-allow-origin")).toBe("*");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("vary")).toContain("Accept");
  expect(response.headers.get("vary")).toContain("Accept-Encoding");
}

/** Asserts one traceable RFC 9457 response without fixing its request ID. */
async function expectProblem(
  response: Response,
  expected: { readonly code: string; readonly status: number }
) {
  expect(response.status).toBe(expected.status);
  expect(response.headers.get("content-type")).toBe(
    "application/problem+json; charset=utf-8"
  );
  if (expected.status === 405) {
    expect(response.headers.get("allow")).toBe("GET, OPTIONS");
  }
  expectPublicJson(response);
  await expect(response.json()).resolves.toMatchObject({
    code: expected.code,
    request_id: expect.any(String),
    status: expected.status,
    type: expect.stringMatching(PROBLEM_TYPE_PATTERN),
  });
}

beforeEach(() => {
  process.env[NAKAFA_API_EDGE_CONTRACT.secretEnvironment] = API_SECRET;
  process.env[POLAR_SECRET_NAME] = "technical-webhook-secret";
});

afterEach(() => {
  delete process.env[NAKAFA_API_EDGE_CONTRACT.secretEnvironment];
  delete process.env[POLAR_SECRET_NAME];
});

describe("public agent API routes", () => {
  it("serves the API index, health response, and CORS preflight", async () => {
    const [index, health, options] = await Promise.all([
      fetchApi("/v1"),
      fetchApi("/v1/health"),
      fetchApi("/v1/search", { method: "OPTIONS" }),
    ]);

    expect(index.status).toBe(200);
    expectPublicJson(index);
    await expect(index.json()).resolves.toMatchObject({
      authentication: "none",
      docs: "https://nakafa.com/developers",
      documentation: "https://nakafa.com/developers",
      name: "Nakafa Public API",
      version: "1.0.0",
    });
    expect(health.status).toBe(200);
    await expect(health.json()).resolves.toMatchObject({
      service: "nakafa-public-api",
      status: "ok",
      timestamp: expect.any(Number),
      version: "1.0.0",
    });
    expect(options.status).toBe(204);
    expect(options.headers.get("access-control-allow-methods")).toBe(
      "GET, OPTIONS"
    );
  });

  it("accepts the charset emitted by public JSON responses", async () => {
    const response = await fetchApi("/v1/health", {
      headers: { accept: "application/json; charset=utf-8" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8"
    );
  });

  it("serves one cacheable OpenAPI document with ETag revalidation", async () => {
    const t = createConvexTestWithBetterAuth();
    const response = await t.fetch("/openapi.json");
    const etag = response.headers.get("etag");
    const revalidated = await t.fetch("/openapi.json", {
      headers: { "if-none-match": etag ?? "missing" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=3600, s-maxage=3600"
    );
    expect(etag).toBeTruthy();
    await expect(response.json()).resolves.toMatchObject({
      info: { title: "Nakafa Public API" },
      openapi: "3.1.1",
    });
    expect(revalidated.status).toBe(304);
    expect(revalidated.headers.get("etag")).toBe(etag);
  });

  it("rejects direct origin access before dispatching a route", async () => {
    const response = await createConvexTestWithBetterAuth().fetch("/v1/health");

    await expectProblem(response, {
      code: "ORIGIN_ACCESS_DENIED",
      status: 403,
    });
  });

  it.each([
    ["/v1/search?unknown=value", {}, "INVALID_REQUEST", 400],
    ["/v1/content", {}, "INVALID_REQUEST", 400],
    ["/v1/search", { headers: { accept: "text/html" } }, "NOT_ACCEPTABLE", 406],
    [
      "/v1/search",
      { headers: { accept: "application/json; charset=iso-8859-1" } },
      "NOT_ACCEPTABLE",
      406,
    ],
    [
      "/v1/health",
      {
        body: "{}",
        headers: { "content-type": "text/plain" },
        method: "OPTIONS",
      },
      "UNSUPPORTED_MEDIA_TYPE",
      415,
    ],
    ["/v1/search?limit=51", {}, "UNPROCESSABLE_REQUEST", 422],
    ["/v1/quran/115", {}, "UNPROCESSABLE_REQUEST", 422],
    ["/v1/missing", {}, "ENDPOINT_NOT_FOUND", 404],
    ["/v1/health", { method: "POST" }, "METHOD_NOT_ALLOWED", 405],
  ] as const)(
    "returns a structured problem for %s",
    async (path, init, code, status) => {
      const response = await fetchApi(path, init);
      await expectProblem(response, { code, status });
    }
  );

  it("returns stable empty search pagination from an empty deployment", async () => {
    const response = await fetchApi(
      "/v1/search?query=algebra&locale=en&limit=10&offset=0"
    );

    expect(response.status).toBe(200);
    expectPublicJson(response);
    await expect(response.json()).resolves.toEqual({
      count: 0,
      has_more: false,
      items: [],
      limit: 10,
      offset: 0,
    });
  });

  it("limits expensive reads by trusted edge client and exempts health", async () => {
    const t = createConvexTestWithBetterAuth();
    const clientAddress = "203.0.113.20";
    const key = await Effect.runPromise(
      deriveAgentRateLimitKey(
        new Request("https://api.nakafa.com/v1/search", {
          headers: { [NAKAFA_EDGE_CLIENT_IP_HEADER]: clientAddress },
        })
      )
    );
    const seeded = await t.mutation(components.rateLimiter.lib.rateLimit, {
      config: AGENT_RATE_LIMIT_CONFIG,
      count: AGENT_RATE_LIMIT_MAX_REQUESTS,
      key,
      name: getAgentRateLimitName("api"),
    });
    const headers = {
      [NAKAFA_API_EDGE_CONTRACT.secretHeader]: API_SECRET,
      [NAKAFA_EDGE_CLIENT_IP_HEADER]: clientAddress,
    };
    const limited = await t.fetch("/v1/search", { headers });
    const health = await t.fetch("/v1/health", { headers });

    expect(seeded.ok).toBe(true);
    await expectProblem(limited, { code: "RATE_LIMITED", status: 429 });
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(health.status).toBe(200);
  });

  it("fails closed when the signed taxonomy publication is unavailable", async () => {
    const response = await fetchApi("/v1/taxonomy?locale=en");

    await expectProblem(response, {
      code: "SERVICE_UNAVAILABLE",
      status: 503,
    });
  });
});
