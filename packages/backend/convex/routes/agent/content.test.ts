// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { MaterialLessonProjectionSchema } from "@nakafa/aksara-contracts/projection/material";
import { deriveMaterialTopicReference } from "@repo/backend/convex/contentRelease/material/topic";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  expectProblem,
  expectPublicJson,
  fetchApi,
  setupApiTest,
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

setupApiTest();

describe("public agent content", () => {
  it("rejects a signed Quran reference with a noncanonical surah route", async () => {
    const test = createConvexTestWithBetterAuth();
    const search = makeQuranSearch("en", 1);
    await test.mutation((ctx) =>
      activateQuranSnapshot(ctx, [
        { ...search, route: PublicPathSchema.make("quran/01") },
      ])
    );
    const response = await fetchApi(
      test,
      `/content?ref=${encodeURIComponent(search.graph.assetId)}`
    );
    await expectProblem(response, { code: "SERVICE_UNAVAILABLE", status: 503 });
  });

  it.each([
    {
      metadata: {
        description: "Exact authored description.",
        subject: "Broader subject",
      },
      expected: "Exact authored description.",
    },
    {
      metadata: { subject: "Exact authored subject" },
      expected: "Exact authored subject",
    },
  ])(
    "preserves optional authored description semantics: %j",
    async ({ metadata, expected }) => {
      const test = createConvexTestWithBetterAuth();
      const source = makeMaterialProjection("en", 1);
      const material = MaterialLessonProjectionSchema.make({
        ...source,
        metadata: { ...source.metadata, ...metadata },
      });
      await activateMaterialCatalog(test, [material], ["en"]);
      const response = await fetchApi(
        test,
        `/content?ref=${encodeURIComponent(material.graph.assetId)}`
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ description: expected });
    }
  );

  it("renders a signed opening Bismillah once before the first verse", async () => {
    const test = createConvexTestWithBetterAuth();
    const bismillah = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";
    await test.mutation((ctx) =>
      activateQuranSnapshot(ctx, [
        makeQuranAttribution(),
        makeQuranSurah(1),
        makeQuranSurah(2),
        makeQuranChunk({
          arabicText: bismillah,
          firstQuranNumber: 1,
          firstVerse: 1,
          surahNumber: 1,
          verseCount: 1,
        }),
        makeQuranChunk({
          arabicText: `${bismillah} آية 1`,
          firstQuranNumber: 2,
          firstVerse: 1,
          surahNumber: 2,
          verseCount: 1,
        }),
        makeQuranSearch("en", 2),
      ])
    );
    const response = await fetchApi(
      test,
      "/content?ref=https%3A%2F%2Fnakafa.com%2Fen%2Fquran%2F2"
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.text).toContain(
      `## Verses\n\n${bismillah}\n\nTranslation: Technical translation 1\n\n### Verse 1\n\nآية 1`
    );
    expect(body.text.split(bismillah)).toHaveLength(2);
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
    const body = response.clone();

    await expectProblem(response, {
      code: "CONTENT_NOT_FOUND",
      status: 404,
    });
    await expect(body.json()).resolves.toMatchObject({
      resolution: expect.stringContaining("/v1/search"),
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
      "/content?ref=asset%3Aen%3Aquran%3Aquran-surah%3A1"
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
    const response = await fetchApi(test, `/content?ref=${reference}`);

    await expectProblem(response, {
      code: "SERVICE_UNAVAILABLE",
      status: 503,
    });
  });
});
