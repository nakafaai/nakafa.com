// @vitest-environment node

import { NAKAFA_API_EDGE_CONTRACT } from "@repo/backend/agent/edge";
import { deriveMaterialTopicReference } from "@repo/backend/convex/contentRelease/material/topic";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { makeMaterialProjection } from "@repo/backend/test/content-material";
import {
  insertRuntimeArticles,
  testArticleProjection,
} from "@repo/backend/test/content-runtime";
import { activateMaterialCatalog } from "@repo/backend/test/material-catalog";
import {
  makeQuranAttribution,
  makeQuranChunk,
  makeQuranSearch,
  makeQuranSurah,
} from "@repo/backend/test/quran/rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran/snapshot";
import { insertRuntimeIndex } from "@repo/backend/test/runtime-head";
import { TEST_RUNTIME_RELEASE } from "@repo/backend/test/runtime-values";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "@repo/testing/effect";
import { vi } from "vitest";

const API_SECRET = "technical-api-edge-secret";
const PROBLEM_TYPE_PATTERN = /^https:\/\/nakafa\.com\/problems\//u;

type BackendTest = ReturnType<typeof createConvexTestWithBetterAuth>;

/** Sends one request through the real Convex router and edge guard. */
function fetchApi(
  test: BackendTest,
  path: string,
  init: RequestInit = {},
  address = "203.0.113.4"
) {
  const headers = new Headers(init.headers);
  headers.set(NAKAFA_API_EDGE_CONTRACT.secretHeader, API_SECRET);
  headers.set("x-forwarded-for", address);
  return test.fetch(`${NAKAFA_API_EDGE_CONTRACT.originPath}${path}`, {
    ...init,
    headers,
  });
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
  vi.stubEnv(NAKAFA_API_EDGE_CONTRACT.secretEnvironment, API_SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("public agent API routes", () => {
  it("serves the API index, health response, and CORS preflight", async () => {
    const test = createConvexTestWithBetterAuth();
    const [index, health, options] = await Promise.all([
      fetchApi(test, "/v1"),
      fetchApi(test, "/v1/health"),
      fetchApi(test, "/v1/search", { method: "OPTIONS" }),
    ]);

    expect(index.status).toBe(200);
    expectPublicJson(index);
    await expect(index.json()).resolves.toMatchObject({
      authentication: "none",
      documentation: "https://nakafa.com/llms.txt",
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

  it("protects and serves the cacheable OpenAPI contract", async () => {
    const test = createConvexTestWithBetterAuth();
    const denied = await test.fetch(
      `${NAKAFA_API_EDGE_CONTRACT.originPath}/openapi.json`
    );
    const response = await fetchApi(test, "/openapi.json");
    const etag = response.headers.get("etag");
    const revalidated = await fetchApi(test, "/openapi.json", {
      headers: { "if-none-match": etag ?? "missing" },
    });

    await expectProblem(denied, {
      code: "ORIGIN_ACCESS_DENIED",
      status: 403,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=3600, s-maxage=3600"
    );
    await expect(response.json()).resolves.toMatchObject({
      info: { title: "Nakafa Public API" },
      openapi: "3.1.1",
    });
    expect(revalidated.status).toBe(304);
    expect(revalidated.headers.get("etag")).toBe(etag);
  });

  it("rejects direct origin access before dispatching a route", async () => {
    const response = await createConvexTestWithBetterAuth().fetch(
      `${NAKAFA_API_EDGE_CONTRACT.originPath}/v1/health`
    );

    await expectProblem(response, {
      code: "ORIGIN_ACCESS_DENIED",
      status: 403,
    });
  });

  it("does not expose the predecessor origin mount", async () => {
    const response = await createConvexTestWithBetterAuth().fetch("/v1");

    expect(response.status).toBe(404);
  });

  it("does not expose a second public API version", async () => {
    const response = await fetchApi(
      createConvexTestWithBetterAuth(),
      "/v2/quran/1?locale=en"
    );

    expect(response.status).toBe(404);
  });

  it.each([
    ["/v1/search?unknown=value", {}, "INVALID_REQUEST", 400],
    ["/v1/content", {}, "INVALID_REQUEST", 400],
    ["/v1/search", { headers: { accept: "text/html" } }, "NOT_ACCEPTABLE", 406],
    [
      "/v1/health",
      { body: "{}", method: "OPTIONS" },
      "UNSUPPORTED_MEDIA_TYPE",
      415,
    ],
    ["/v1/search?limit=11", {}, "UNPROCESSABLE_REQUEST", 422],
    ["/v1/content?ref=", {}, "UNPROCESSABLE_REQUEST", 422],
    [
      "/v1/content?ref=https%3A%2F%2Fexample.com%2Fen%2Fquran%2F1",
      {},
      "UNPROCESSABLE_REQUEST",
      422,
    ],
    ["/v1/quran/115", {}, "UNPROCESSABLE_REQUEST", 422],
    ["/v1/missing", {}, "ENDPOINT_NOT_FOUND", 404],
    ["/v1/health", { method: "POST" }, "METHOD_NOT_ALLOWED", 405],
  ] as const)(
    "returns a structured problem for %s",
    async (path, init, code, status) => {
      const response = await fetchApi(
        createConvexTestWithBetterAuth(),
        path,
        init
      );
      await expectProblem(response, { code, status });
    }
  );

  it("returns stable empty search pagination from an empty deployment", async () => {
    const response = await fetchApi(
      createConvexTestWithBetterAuth(),
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

  it("searches one authenticated current article", async () => {
    const test = createConvexTestWithBetterAuth();
    const article = testArticleProjection(0);
    await test.mutation(async (ctx) => {
      await insertRuntimeArticles(ctx, 1);
      await insertRuntimeIndex(ctx, article.contentKey, {
        plainText: "rational function grade eleven asymptote",
      });
      const state = await ctx.db.query("contentState").unique();
      if (!state) {
        expect.fail("Expected one active content state.");
      }
      await ctx.db.patch("contentState", state._id, {
        searchManifestHash: TEST_RUNTIME_RELEASE.manifestHash,
        searchReleaseId: TEST_RUNTIME_RELEASE.releaseId,
        searchSequence: TEST_RUNTIME_RELEASE.sequence,
      });
    });
    const response = await fetchApi(
      test,
      "/v1/search?query=rational%20function&locale=en&section=articles"
    );

    expect(response.status).toBe(200);
    expectPublicJson(response);
    await expect(response.json()).resolves.toMatchObject({
      count: 1,
      has_more: false,
      items: [
        {
          content_id: article.graph.assetId,
          route: article.publicPath,
          section: "articles",
          title: article.metadata.title,
        },
      ],
    });
  });

  it("reads authenticated article markdown through its canonical URL", async () => {
    const test = createConvexTestWithBetterAuth();
    const article = testArticleProjection(0);
    await test.mutation((ctx) => insertRuntimeArticles(ctx, 1));
    const reference = encodeURIComponent(
      `https://nakafa.com/en/${article.publicPath}`
    );
    const response = await fetchApi(test, `/v1/content?ref=${reference}`);

    expect(response.status).toBe(200);
    expectPublicJson(response);
    await expect(response.json()).resolves.toMatchObject({
      content_id: article.graph.assetId,
      locale: "en",
      route: article.publicPath,
      section: "articles",
      text: expect.stringContaining("## Technical fixture"),
      title: article.metadata.title,
    });
  });

  it("reads authenticated material markdown through its content ID", async () => {
    const test = createConvexTestWithBetterAuth();
    const material = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(test, [material], ["en"]);
    const response = await fetchApi(
      test,
      `/v1/content?ref=${encodeURIComponent(material.graph.assetId)}`
    );

    expect(response.status).toBe(200);
    expectPublicJson(response);
    await expect(response.json()).resolves.toMatchObject({
      content_id: material.graph.assetId,
      locale: "en",
      route: material.publicPath,
      section: "material",
      text: expect.stringContaining("## Technical fixture"),
      title: material.metadata.title,
    });
  });

  it("keeps material topics citation-only without a runtime read", async () => {
    const test = createConvexTestWithBetterAuth();
    const material = makeMaterialProjection("en", 1);
    const topic = await runConvexProgram(
      deriveMaterialTopicReference(material)
    );
    await activateMaterialCatalog(test, [material], ["en"]);

    const response = await fetchApi(
      test,
      `/v1/content?ref=${encodeURIComponent(topic.graph.assetId)}`
    );

    await expectProblem(response, {
      code: "CONTENT_NOT_FOUND",
      status: 404,
    });
  });

  it("reads Quran markdown through one transactionally pinned source", async () => {
    const test = createConvexTestWithBetterAuth();
    await test.mutation((ctx) =>
      activateQuranSnapshot(ctx, [
        makeQuranAttribution(),
        makeQuranSurah(1),
        makeQuranChunk({
          firstQuranNumber: 1,
          firstVerse: 1,
          surahNumber: 1,
          translationFootnotes: {
            en: "[1] Exact English source note.",
          },
          translationText: {
            en: "Technical translation 1[1]",
          },
          verseCount: 1,
        }),
        makeQuranSearch("en", 1),
      ])
    );
    const response = await fetchApi(
      test,
      "/v1/content?ref=asset%3Aen%3Aquran%3Aquran-surah%3A1"
    );

    expect(response.status).toBe(200);
    expectPublicJson(response);
    const body = await response.json();
    expect(body).toMatchObject({
      content_id: "asset:en:quran:quran-surah:1",
      locale: "en",
      route: "quran/1",
      section: "quran",
      text: expect.stringContaining("Technical translation 1[1]"),
      title: "Technical Surah 1",
    });
    expect(body.text).not.toContain("translation note 1");
    expect(body.text).not.toContain("Technical English Tafsir notice.");
  });

  it("returns one bounded authenticated Quran reference", async () => {
    const test = createConvexTestWithBetterAuth();
    await test.mutation((ctx) =>
      activateQuranSnapshot(ctx, [
        makeQuranAttribution(),
        ...Array.from({ length: 114 }, (_, index) => makeQuranSurah(index + 1)),
        makeQuranChunk({
          firstQuranNumber: 1,
          firstVerse: 1,
          surahNumber: 1,
          translationFootnotes: {
            id: "[4] Catatan sumber Indonesia.",
          },
          translationText: {
            id: "Terjemahan teknis 1[4]",
          },
          verseCount: 1,
        }),
        makeQuranSearch("id", 1),
      ])
    );
    const response = await fetchApi(
      test,
      "/v1/quran/1?locale=id&from_verse=1&include_tafsir=true"
    );

    expect(response.status).toBe(200);
    expectPublicJson(response);
    await expect(response.json()).resolves.toEqual({
      alignmentId: "alignment:quran:quran-surah:1",
      assetId: "asset:id:quran:quran-surah:1",
      conceptId: "concept:quran:surah:1",
      content_id: "asset:id:quran:quran-surah:1",
      learningObjectId: "lo:quran-surah:1",
      lensId: "lens:quran",
      locale: "id",
      markdown_url: "https://nakafa.com/id/quran/1.md",
      name: "Technical Surah 1",
      revelation: "Meccan",
      route: "quran/1",
      section: "quran",
      translation: "Technical meaning 1",
      url: "https://nakafa.com/id/quran/1",
      verses: [
        {
          arabic: "آية 1",
          number: 1,
          tafsir: "Tafsir teknis 1",
          translation: "Terjemahan teknis 1[4]",
        },
      ],
    });
  });

  it("fails closed when an article catalog identity is corrupted", async () => {
    const test = createConvexTestWithBetterAuth();
    const article = testArticleProjection(0);
    await test.mutation(async (ctx) => {
      await insertRuntimeArticles(ctx, 1);
      const row = await ctx.db.query("articleCatalog").unique();
      if (!row) {
        expect.fail("Expected one article catalog row.");
      }
      await ctx.db.patch("articleCatalog", row._id, {
        assetId: "asset:en:article:politics:article:politics:corrupted",
      });
    });
    const reference = encodeURIComponent(
      `https://nakafa.com/en/${article.publicPath}`
    );
    const response = await fetchApi(test, `/v1/content?ref=${reference}`);

    await expectProblem(response, {
      code: "SERVICE_UNAVAILABLE",
      status: 503,
    });
  });

  it("fails closed when the signed taxonomy publication is unavailable", async () => {
    const response = await fetchApi(
      createConvexTestWithBetterAuth(),
      "/v1/taxonomy?locale=en"
    );

    await expectProblem(response, {
      code: "SERVICE_UNAVAILABLE",
      status: 503,
    });
  });

  it("fails closed when the trusted quota identity is unavailable", async () => {
    const test = createConvexTestWithBetterAuth();
    const headers = new Headers({
      [NAKAFA_API_EDGE_CONTRACT.secretHeader]: API_SECRET,
    });
    const response = await test.fetch(
      `${NAKAFA_API_EDGE_CONTRACT.originPath}/v1/search`,
      { headers }
    );

    await expectProblem(response, {
      code: "SERVICE_UNAVAILABLE",
      status: 503,
    });
  });

  it("limits metered reads without limiting health checks", async () => {
    const test = createConvexTestWithBetterAuth();
    for (let index = 0; index < 30; index += 1) {
      expect((await fetchApi(test, "/v1/search")).status).toBe(200);
      expect((await fetchApi(test, "/v1/health")).status).toBe(200);
    }
    const limited = await fetchApi(test, "/v1/search");

    await expectProblem(limited, { code: "RATE_LIMITED", status: 429 });
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});
