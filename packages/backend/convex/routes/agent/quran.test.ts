// @vitest-environment node

import { NAKAFA_API_EDGE_CONTRACT } from "@repo/backend/agent/edge";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  makeQuranAttribution,
  makeQuranChunk,
  makeQuranSearch,
  makeQuranSurah,
} from "@repo/backend/test/quran/rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran/snapshot";
import { NakafaAgentQuranReferenceSchema } from "@repo/contents/_lib/agent/schema/quran/reference";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "@repo/testing/effect";
import { Schema } from "effect";
import { vi } from "vitest";

const API_SECRET = "technical-api-edge-secret";
const BISMILLAH = "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ";
const FORWARDED_IP = {
  de: "203.0.113.12",
  en: "203.0.113.10",
  id: "203.0.113.11",
} as const;
const LOCALE_EXPECTATIONS = {
  de: {
    meaning: null,
    note: 2,
    tafsir: "mokhtasar-german",
    tafsirKind: "external",
    translation: "quranenc-german",
  },
  en: {
    meaning: { locale: "en", text: "Technical meaning 1" },
    note: 1,
    tafsir: "mokhtasar-english",
    tafsirKind: "external",
    translation: "quranenc-english",
  },
  id: {
    meaning: null,
    note: 5,
    tafsir: "quranenc-tafsir",
    tafsirKind: "embedded",
    translation: "quranenc-indonesian",
  },
} as const;

beforeEach(() => {
  vi.stubEnv(NAKAFA_API_EDGE_CONTRACT.secretEnvironment, API_SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("public Quran route", () => {
  it("preserves semantic notes and signed EN, ID, and DE source access", async () => {
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
            de: "[2] Deutsche Quellanmerkung.",
            en: "[1] Exact English source note.",
            id: "[5] Catatan sumber Indonesia.",
          },
          translationText: {
            de: "Technische Übersetzung 1[2]",
            en: "Technical translation 1[1]",
            id: "Terjemahan teknis 1[5]",
          },
          verseCount: 1,
        }),
        makeQuranSearch("en", 1),
        makeQuranSearch("id", 1),
        makeQuranSearch("de", 1),
      ])
    );

    for (const locale of ["en", "id", "de"] as const) {
      const response = await fetchQuran(test, locale);
      expect(response.status).toBe(200);
      const raw: unknown = await response.json();
      const body = Schema.decodeUnknownSync(NakafaAgentQuranReferenceSchema)(
        raw,
        { onExcessProperty: "error" }
      );
      const expected = LOCALE_EXPECTATIONS[locale];
      const verse = body.verses[0];

      expect(body.meaning).toEqual(expected.meaning);
      expect(body.pre_bismillah).toBeNull();
      expect(body.sources.arabic.id).toBe("tanzil-text");
      expect(body.sources.translation).toMatchObject({
        id: expected.translation,
        kind: "embedded",
        locale,
      });
      expect(body.tafsir_access).toMatchObject({
        kind: expected.tafsirKind,
        locale,
        source: { id: expected.tafsir },
      });
      expect(verse?.translation.notes).toEqual([
        expect.objectContaining({ number: expected.note }),
      ]);
      expect(verse?.translation.segments).toEqual([
        expect.objectContaining({ kind: "text", offset: 0 }),
        expect.objectContaining({ kind: "note", number: expected.note }),
      ]);
      if (locale === "id") {
        expect(verse?.tafsir).toBe("Tafsir teknis 1");
      } else {
        expect(verse?.tafsir).toBeUndefined();
      }
      expect(JSON.stringify(body)).not.toContain(`[${expected.note}]`);
    }
  }, 15_000);

  it("keeps Al-Baqarah Bismillah outside numbered verse 1", async () => {
    const test = createConvexTestWithBetterAuth();
    await test.mutation((ctx) =>
      activateQuranSnapshot(ctx, [
        makeQuranAttribution(),
        ...Array.from({ length: 114 }, (_, index) => makeQuranSurah(index + 1)),
        makeQuranChunk({
          arabicText: BISMILLAH,
          firstQuranNumber: 1,
          firstVerse: 1,
          surahNumber: 1,
          verseCount: 1,
        }),
        makeQuranChunk({
          arabicText: `${BISMILLAH} الٓمٓ`,
          firstQuranNumber: 2,
          firstVerse: 1,
          surahNumber: 2,
          verseCount: 1,
        }),
        makeQuranSearch("id", 2),
      ])
    );

    const response = await fetchQuran(test, "id", 2);
    expect(response.status).toBe(200);
    const body = Schema.decodeUnknownSync(NakafaAgentQuranReferenceSchema)(
      await response.json(),
      { onExcessProperty: "error" }
    );

    expect(body.pre_bismillah).toEqual({
      arabic: BISMILLAH,
      translation: "Terjemahan teknis 1",
    });
    expect(body.verses[0]?.arabic).toBe("الٓمٓ");
  });
});

/** Requests one locale through the real protected Convex HTTP router. */
function fetchQuran(
  test: ReturnType<typeof createConvexTestWithBetterAuth>,
  locale: "de" | "en" | "id",
  surah = 1
) {
  return test.fetch(
    `${NAKAFA_API_EDGE_CONTRACT.originPath}/v1/quran/${surah}?locale=${locale}&include_tafsir=true`,
    {
      headers: {
        [NAKAFA_API_EDGE_CONTRACT.secretHeader]: API_SECRET,
        "x-forwarded-for": FORWARDED_IP[locale],
      },
    }
  );
}
