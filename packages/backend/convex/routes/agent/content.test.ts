// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { deriveMaterialTopicReference } from "@repo/backend/convex/contentRelease/material/topic";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  expectProblem,
  expectPublicJson,
  fetchApi,
  restoreApiSecret,
  stubApiSecret,
} from "@repo/backend/test/agent/http";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import {
  insertRuntimeArticles,
  testArticleProjection,
} from "@repo/backend/test/content/runtime";
import { activateMaterialCatalog } from "@repo/backend/test/material/catalog";
import {
  makeQuranAttribution,
  makeQuranChunk,
  makeQuranSearch,
  makeQuranSurah,
} from "@repo/backend/test/quran/rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran/snapshot";

beforeEach(stubApiSecret);
afterEach(restoreApiSecret);

describe("public agent content", () => {
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
      text: expect.stringContaining(
        "Technical translation 1[translation note 1]"
      ),
      title: "Technical Surah 1",
    });
    expect(body.text).toContain("Translation notes:");
    expect(body.text).toContain("Exact English source note.");
    expect(body.text).toContain("## Reading sources");
    expect(body.text).toContain("https://example.test/tanzil-text/terms");
    expect(body.text).toContain(
      "https://example.test/quranenc-english/updates"
    );
    expect(body.text).toContain("Version: technical-version");
    expect(body.text).toContain("Technical English Tafsir notice.");
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
});
