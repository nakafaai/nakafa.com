// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  expectProblem,
  expectPublicJson,
  fetchApi,
  setupApiTest,
} from "@repo/backend/test/agent/http";
import {
  makeQuranAttribution,
  makeQuranChunk,
  makeQuranSearch,
  makeQuranSurah,
} from "@repo/backend/test/quran/rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran/snapshot";
import { NAKAFA_AGENT_MAX_QURAN_REFERENCE_VERSES } from "@repo/contents/_lib/agent/constants";

setupApiTest();

describe("public Quran API routes", () => {
  it.each([
    "/quran/1?from_verse=2&to_verse=1",
    `/quran/1?from_verse=1&to_verse=${NAKAFA_AGENT_MAX_QURAN_REFERENCE_VERSES + 1}`,
  ])(
    "rejects invalid passage bounds before reading publication: %s",
    async (path) => {
      await expectProblem(
        await fetchApi(createConvexTestWithBetterAuth(), path),
        { code: "UNPROCESSABLE_REQUEST", status: 422 }
      );
    }
  );

  it("rejects a verse beyond the signed surah length", async () => {
    const test = createConvexTestWithBetterAuth();
    await test.mutation((ctx) =>
      activateQuranSnapshot(ctx, [
        makeQuranAttribution(),
        ...Array.from({ length: 114 }, (_, index) => makeQuranSurah(index + 1)),
      ])
    );
    await expectProblem(
      await fetchApi(test, "/quran/1?from_verse=1&to_verse=2"),
      { code: "UNPROCESSABLE_REQUEST", status: 422 }
    );
  });

  it("fails closed when no signed Quran catalog is available", async () => {
    await expectProblem(
      await fetchApi(createConvexTestWithBetterAuth(), "/quran/1"),
      { code: "SERVICE_UNAVAILABLE", status: 503 }
    );
  });

  it("rejects a signed search graph without a public asset identity", async () => {
    const test = createConvexTestWithBetterAuth();
    const search = makeQuranSearch("en", 1);
    await test.mutation((ctx) =>
      activateQuranSnapshot(ctx, [
        makeQuranAttribution(),
        ...Array.from({ length: 114 }, (_, index) => makeQuranSurah(index + 1)),
        makeQuranChunk({
          firstQuranNumber: 1,
          firstVerse: 1,
          surahNumber: 1,
          verseCount: 1,
        }),
        { ...search, graph: { ...search.graph, assetId: "asset:en" } },
      ])
    );
    await expectProblem(await fetchApi(test, "/quran/1?locale=en"), {
      code: "SERVICE_UNAVAILABLE",
      status: 503,
    });
  });

  it.each(["/v2/quran/1", "/v2/quran/1?locale=en"])(
    "rejects the unsupported public namespace %s",
    async (path) => {
      const response = await fetchApi(createConvexTestWithBetterAuth(), path);

      expect(response.status).toBe(404);
    }
  );

  it("rejects an out-of-range canonical surah", async () => {
    const response = await fetchApi(
      createConvexTestWithBetterAuth(),
      "/quran/115"
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
    expect(body.text).toContain("Meaning: Technical meaning 1");
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
      "/quran/1?locale=id&from_verse=1&include_tafsir=true"
    );

    expect(response.status).toBe(200);
    expectPublicJson(response);
    const body = await response.json();
    expect(body).toMatchObject({
      alignmentId: "alignment:quran:quran-surah:1",
      assetId: "asset:id:quran:quran-surah:1",
      conceptId: "concept:quran:surah:1",
      content_id: "asset:id:quran:quran-surah:1",
      learningObjectId: "lo:quran-surah:1",
      lensId: "lens:quran",
      locale: "id",
      markdown_url: "https://nakafa.com/id/quran/1.md",
      meaning: { locale: "id", text: "Arti teknis 1" },
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

  it("returns English references with signed external tafsir access", async () => {
    const test = createConvexTestWithBetterAuth();
    await test.mutation((ctx) =>
      activateQuranSnapshot(ctx, [
        makeQuranAttribution(),
        ...Array.from({ length: 114 }, (_, index) => makeQuranSurah(index + 1)),
        makeQuranChunk({
          firstQuranNumber: 1,
          firstVerse: 1,
          surahNumber: 1,
          verseCount: 1,
        }),
        makeQuranSearch("en", 1),
      ])
    );
    const response = await fetchApi(test, "/quran/1?locale=en");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      locale: "en",
      tafsir_access: {
        kind: "external",
        locale: "en",
        source: { kind: "external" },
      },
      verses: [
        {
          number: 1,
          translation: {
            segments: [
              { kind: "text", offset: 0, value: "Technical translation 1" },
            ],
          },
        },
      ],
    });
    expect(body.verses[0]).not.toHaveProperty("tafsir");
  });
});
