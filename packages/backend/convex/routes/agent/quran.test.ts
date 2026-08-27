// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  expectProblem,
  expectPublicJson,
  fetchApi,
  setupApiTest,
} from "@repo/backend/test/api";
import {
  makeQuranAttribution,
  makeQuranChunk,
  makeQuranSearch,
  makeQuranSurah,
} from "@repo/backend/test/quran/rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran/snapshot";
setupApiTest();

describe("public Quran API routes", () => {
  it.each([
    "/quran/1",
    "/quran/1?locale=en",
    "/v2/quran/1",
    "/v2/quran/1?locale=en",
  ])("does not expose the retired Quran path %s", async (path) => {
    const response = await fetchApi(createConvexTestWithBetterAuth(), path);

    expect(response.status).toBe(404);
  });

  it("rejects an out-of-range canonical surah", async () => {
    const response = await fetchApi(
      createConvexTestWithBetterAuth(),
      "/v1/quran/115"
    );

    await expectProblem(response, {
      code: "UNPROCESSABLE_REQUEST",
      status: 422,
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
    expect(body.text).toContain("Meaning: Technical meaning 1 (en)");
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
    expect(await response.json()).toMatchObject({
      alignmentId: "alignment:quran:quran-surah:1",
      assetId: "asset:id:quran:quran-surah:1",
      conceptId: "concept:quran:surah:1",
      content_id: "asset:id:quran:quran-surah:1",
      learningObjectId: "lo:quran-surah:1",
      lensId: "lens:quran",
      locale: "id",
      markdown_url: "https://nakafa.com/id/quran/1.md",
      meaning: { locale: "en", text: "Technical meaning 1" },
      name: "Technical Surah 1",
      pre_bismillah: null,
      revelation: "Meccan",
      route: "quran/1",
      section: "quran",
      sources: {
        arabic: { id: "tanzil-text", kind: "embedded" },
        translation: {
          id: "quranenc-indonesian",
          kind: "embedded",
          locale: "id",
        },
      },
      tafsir_access: {
        kind: "embedded",
        locale: "id",
        source: { id: "quranenc-tafsir" },
      },
      url: "https://nakafa.com/id/quran/1",
      verses: [
        {
          arabic: "آية 1",
          number: 1,
          tafsir: "Tafsir teknis 1",
          translation: {
            notes: [{ number: 4, text: "Catatan sumber Indonesia." }],
            segments: [
              { kind: "text", offset: 0, value: "Terjemahan teknis 1" },
              { kind: "note", number: 4 },
            ],
          },
        },
      ],
    });
  });
});
