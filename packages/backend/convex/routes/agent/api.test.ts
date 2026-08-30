// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { NAKAFA_API_EDGE_CONTRACT } from "@repo/backend/agent/edge";
import { deriveMaterialTopicReference } from "@repo/backend/convex/contentRelease/material/topic";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  API_SECRET,
  expectProblem,
  expectPublicJson,
  fetchApi,
  setupApiTest,
} from "@repo/backend/test/api";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import {
  insertRuntimeArticles,
  testArticleProjection,
} from "@repo/backend/test/content/runtime";
import { activateMaterialCatalog } from "@repo/backend/test/material/catalog";
import { insertRuntimeIndex } from "@repo/backend/test/runtime/head";
import { TEST_RUNTIME_RELEASE } from "@repo/backend/test/runtime/values";

setupApiTest();

describe("public agent API routes", () => {
  it("serves the API index, health response, and CORS preflight", async () => {
    const test = createConvexTestWithBetterAuth();
    const [index, health, options] = await Promise.all([
      fetchApi(test, "/"),
      fetchApi(test, "/health"),
      fetchApi(test, "/search", { method: "OPTIONS" }),
    ]);

    expect(index.status).toBe(200);
    expectPublicJson(index);
    await expect(index.json()).resolves.toMatchObject({
      authentication: "none",
      documentation: "https://nakafa.com/llms.txt",
      name: "Nakafa Public API",
      version: "2.0.0",
    });
    expect(health.status).toBe(200);
    await expect(health.json()).resolves.toMatchObject({
      service: "nakafa-public-api",
      status: "ok",
      timestamp: expect.any(Number),
      version: "2.0.0",
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

  it.each(["/", "/health", "/quran/1?locale=en"])(
    "rejects direct origin access to %s before dispatching a route",
    async (path) => {
      const response = await createConvexTestWithBetterAuth().fetch(
        `${NAKAFA_API_EDGE_CONTRACT.originPath}${path}`
      );

      await expectProblem(response, {
        code: "ORIGIN_ACCESS_DENIED",
        status: 403,
      });
    }
  );

  it("does not expose the predecessor origin mount", async () => {
    const response = await createConvexTestWithBetterAuth().fetch("/");

    expect(response.status).toBe(404);
  });

  it.each(["/v1", "/v1/health", "/v1/search?query=algebra"])(
    "keeps predecessor route %s readable during the deployment transition",
    async (path) => {
      const response = await fetchApi(createConvexTestWithBetterAuth(), path);

      expect(response.status).toBe(200);
    }
  );

  it.each(["/v1/openapi.json", "/v2", "/v2/search"])(
    "does not expose retired versioned path %s",
    async (path) => {
      const response = await fetchApi(createConvexTestWithBetterAuth(), path);

      await expectProblem(response, {
        code: "ENDPOINT_NOT_FOUND",
        status: 404,
      });
    }
  );

  it.each([
    ["/search?unknown=value", {}, "INVALID_REQUEST", 400],
    ["/content", {}, "INVALID_REQUEST", 400],
    ["/v1/content", {}, "INVALID_REQUEST", 400],
    ["/search", { headers: { accept: "text/html" } }, "NOT_ACCEPTABLE", 406],
    [
      "/health",
      { body: "{}", method: "OPTIONS" },
      "UNSUPPORTED_MEDIA_TYPE",
      415,
    ],
    ["/search?limit=11", {}, "UNPROCESSABLE_REQUEST", 422],
    ["/content?ref=", {}, "UNPROCESSABLE_REQUEST", 422],
    [
      "/content?ref=https%3A%2F%2Fexample.com%2Fen%2Fquran%2F1",
      {},
      "UNPROCESSABLE_REQUEST",
      422,
    ],
    ["/missing", {}, "ENDPOINT_NOT_FOUND", 404],
    ["/health", { method: "POST" }, "METHOD_NOT_ALLOWED", 405],
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
      "/search?query=algebra&locale=en&limit=10&offset=0"
    );

    expect(response.status).toBe(200);
    expectPublicJson(response);
    await expect(response.json()).resolves.toMatchObject({
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
      "/search?query=rational%20function&locale=en&section=articles"
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
    const response = await fetchApi(test, `/content?ref=${reference}`);

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
      `/content?ref=${encodeURIComponent(material.graph.assetId)}`
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
      `/content?ref=${encodeURIComponent(topic.graph.assetId)}`
    );

    await expectProblem(response, {
      code: "CONTENT_NOT_FOUND",
      status: 404,
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
    const response = await fetchApi(test, `/content?ref=${reference}`);

    await expectProblem(response, {
      code: "SERVICE_UNAVAILABLE",
      status: 503,
    });
  });

  it("fails closed when the signed taxonomy publication is unavailable", async () => {
    const test = createConvexTestWithBetterAuth();
    const [response, predecessor] = await Promise.all([
      fetchApi(test, "/taxonomy?locale=en"),
      fetchApi(test, "/v1/taxonomy?locale=en"),
    ]);

    await expectProblem(response, {
      code: "SERVICE_UNAVAILABLE",
      status: 503,
    });
    await expectProblem(predecessor, {
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
      `${NAKAFA_API_EDGE_CONTRACT.originPath}/search`,
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
      expect((await fetchApi(test, "/search")).status).toBe(200);
      expect((await fetchApi(test, "/health")).status).toBe(200);
    }
    const limited = await fetchApi(test, "/search");

    await expectProblem(limited, { code: "RATE_LIMITED", status: 429 });
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});
